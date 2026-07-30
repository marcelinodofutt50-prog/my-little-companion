import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { assertAdminRole } = await import("@/lib/roles.server");
  await assertAdminRole(ctx);
}

const panelEnum = z.enum(["v457", "v46"]);

/** Lista os servidores configurados + o que está valendo no ambiente. */
export const adminListPanelServers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listPanelServersMasked } = await import("@/lib/panel-servers.server");
    const { panelBaseUrl, panelServerHost, panelConfigSource, refreshPanelOverrides } = await import(
      "@/lib/yaarsa.server"
    );
    await refreshPanelOverrides(true);
    const rows = await listPanelServersMasked();
    const effective = {
      v457: panelBaseUrl("v457"),
      v46: panelBaseUrl("v46"),
    };
    const effectiveIp = {
      v457: panelServerHost("v457"),
      v46: panelServerHost("v46"),
    };
    const source = {
      v457: panelConfigSource("v457"),
      v46: panelConfigSource("v46"),
    };
    const envFallback = {
      v457: (process.env.YAARSA_BASE_URL || "").trim() || null,
      v46: (process.env.YAARSA_V46_BASE_URL || "").trim() || null,
    };
    return { rows, effective, effectiveIp, source, envFallback };
  });

/** Testa endereço + admin key sem gravar nada. */
export const adminTestPanelServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ baseUrl: z.string().trim().min(4).max(300), adminKey: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { probePanelConfig } = await import("@/lib/panel-servers.server");
    return probePanelConfig(data.baseUrl, data.adminKey);
  });

/** Cadastra ou substitui o servidor (VPS) de um painel. */
export const adminSavePanelServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        panel: panelEnum,
        label: z.string().trim().max(80).default(""),
        baseUrl: z.string().trim().min(4).max(300),
        adminKey: z.string().trim().max(200).optional().nullable(),
        notes: z.string().trim().max(500).optional().nullable(),
        isActive: z.boolean().default(true),
        skipTest: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { upsertPanelServer, probePanelConfig, recordPanelTest, listPanelServersMasked } = await import(
      "@/lib/panel-servers.server"
    );

    // Se o admin não quiser pular, validamos ANTES de gravar — assim nunca
    // trocamos um servidor que funciona por um endereço quebrado.
    let test: { ok: boolean; message: string } | null = null;
    if (!data.skipTest && data.adminKey && data.adminKey.trim()) {
      test = await probePanelConfig(data.baseUrl, data.adminKey);
      if (!test.ok) {
        return { saved: false, test, message: `Não gravei: ${test.message}` };
      }
    }

    await upsertPanelServer({
      panel: data.panel,
      label: data.label,
      baseUrl: data.baseUrl,
      adminKey: data.adminKey ?? null,
      notes: data.notes ?? null,
      isActive: data.isActive,
      actorId: context.userId,
      actorEmail: (context.claims?.email as string | undefined) ?? null,
    });

    if (test) await recordPanelTest(data.panel, test.ok, test.message);

    const { refreshPanelOverrides } = await import("@/lib/yaarsa.server");
    await refreshPanelOverrides(true);

    const rows = await listPanelServersMasked();
    return { saved: true, test, message: "Servidor salvo e já em uso.", rows };
  });

/** Remove o override e volta a usar as variáveis de ambiente. */
export const adminResetPanelServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ panel: panelEnum }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { deletePanelServer } = await import("@/lib/panel-servers.server");
    await deletePanelServer(data.panel);
    const { refreshPanelOverrides } = await import("@/lib/yaarsa.server");
    await refreshPanelOverrides(true);
    return { ok: true };
  });

/** Testa o servidor que está valendo agora para um painel. */
export const adminTestCurrentPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ panel: panelEnum }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { yaarsaLookupEmail } = await import("@/lib/yaarsa.server");
    const { recordPanelTest } = await import("@/lib/panel-servers.server");
    try {
      await yaarsaLookupEmail(`probe-${Date.now()}@shadow-check.invalid`, data.panel);
      await recordPanelTest(data.panel, true, "Servidor respondendo.");
      return { ok: true, message: "Servidor respondendo normalmente." };
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      await recordPanelTest(data.panel, false, msg);
      return { ok: false, message: msg };
    }
  });

/**
 * Verificação COMPLETA de ponta a ponta de um painel: faz exatamente o que
 * acontece quando um cliente compra — cria uma conta de teste, ajusta a data,
 * troca a senha, confirma que a conta existe e apaga tudo no fim.
 *
 * Se todos os passos passarem, uma compra real naquele painel entrega o login.
 */
export const adminFullPanelCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ panel: panelEnum }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const y = await import("@/lib/yaarsa.server");
    const { recordPanelTest } = await import("@/lib/panel-servers.server");
    await y.refreshPanelOverrides(true);

    const steps: { step: string; ok: boolean; detail: string }[] = [];
    const push = (step: string, ok: boolean, detail: string) => steps.push({ step, ok, detail });

    const baseUrl = y.panelBaseUrl(data.panel);
    const serverIp = y.panelServerHost(data.panel);
    const source = y.panelConfigSource(data.panel);
    push("Endereço configurado", !!baseUrl, `${baseUrl} (origem: ${source})`);

    let keyOk = true;
    try {
      // Só valida presença/format — o valor nunca sai daqui.
      const probe = await y.yaarsaLookupEmail(`probe-${Date.now()}@shadow-check.invalid`, data.panel);
      push("Servidor responde e aceita a admin key", true, probe.found ? "resposta válida" : "resposta válida");
    } catch (e) {
      keyOk = false;
      push("Servidor responde e aceita a admin key", false, String((e as Error)?.message || e));
    }

    let created = false;
    let creds: { username: string; email: string; password: string } | null = null;
    if (keyOk) {
      creds = y.generateCredentials();
      const suffix = `-chk${Date.now().toString().slice(-5)}`;
      creds = {
        username: `${creds.username}${suffix}`.slice(0, 24),
        email: creds.email.replace("@", `${suffix}@`),
        password: creds.password,
      };
      const r = await y.yaarsaCreateAccount({
        username: creds.username,
        email: creds.email,
        password: creds.password,
        planSlug: "login-7d",
        totalPaid: 0,
        additionalInfo: "shadow-healthcheck",
        panel: data.panel,
      });
      created = !r.Fail;
      push("Criar login de teste (igual a uma compra)", created, r.Fail ?? r.Success ?? "ok");
    }

    if (created && creds) {
      const ymd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const ext = await y.yaarsaExtend(creds.email, ymd, data.panel);
      push("Ajustar validade do login", !ext.Fail, ext.Fail ?? ext.Success ?? "ok");

      const pw = await y.yaarsaSetPassword(creds.email, creds.password, data.panel, creds.username);
      push("Definir senha do cliente", !pw.Fail, pw.Fail ?? pw.Success ?? "ok");

      try {
        const look = await y.yaarsaLookupEmail(creds.email, data.panel);
        push("Confirmar que o login existe no painel", look.found, look.found ? "encontrado" : "não encontrado");
      } catch (e) {
        push("Confirmar que o login existe no painel", false, String((e as Error)?.message || e));
      }

      const rm = await y.yaarsaRemoveAccount(creds.email, data.panel);
      push("Remover login de teste", !rm.Fail, rm.Fail ?? rm.Success ?? "ok");
    }

    const ok = steps.every((s) => s.ok);
    const message = ok
      ? `Tudo certo — uma compra na ${data.panel === "v46" ? "4.6" : "4.5.7"} entrega o login normalmente. IP entregue ao cliente: ${serverIp}`
      : `Falhou em: ${steps.filter((s) => !s.ok).map((s) => s.step).join(", ")}`;
    await recordPanelTest(data.panel, ok, message);
    return { ok, steps, serverIp, baseUrl, source, message };
  });
