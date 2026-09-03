import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { assertAdminRole } = await import("@/lib/roles.server");
  await assertAdminRole(ctx);
}

const panelEnum = z.enum(["v455", "v457", "v46"]);

/** Lista os servidores configurados + o que está valendo no ambiente. */
export const adminListPanelServers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listPanelServersMasked } = await import("@/lib/panel-servers.server");
    const { panelBaseUrl, panelServerHost, panelConfigSource, refreshPanelOverrides } =
      await import("@/lib/yaarsa.server");
    await refreshPanelOverrides(true);
    const rows = await listPanelServersMasked();
    const effective = {
      v455: panelBaseUrl("v455"),
      v457: panelBaseUrl("v457"),
      v46: panelBaseUrl("v46"),
    };
    const effectiveIp = {
      v455: panelServerHost("v455"),
      v457: panelServerHost("v457"),
      v46: panelServerHost("v46"),
    };
    const source = {
      v455: panelConfigSource("v455"),
      v457: panelConfigSource("v457"),
      v46: panelConfigSource("v46"),
    };
    const envFallback = {
      v455: (process.env.YAARSA_V455_BASE_URL || "").trim() || null,
      v457: (process.env.YAARSA_BASE_URL || "").trim() || null,
      v46: (process.env.YAARSA_V46_BASE_URL || "").trim() || null,
    };
    return { rows, effective, effectiveIp, source, envFallback };
  });

/** Testa endereço + admin key sem gravar nada. */
export const adminTestPanelServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        baseUrl: z.string().trim().min(4).max(300),
        adminKey: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { probePanelConfig } = await import("@/lib/panel-servers.server");
    return probePanelConfig(data.baseUrl, data.adminKey);
  });

/** Cadastra ou substitui o servidor (VPS) de um painel. */
export const adminSavePanelServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
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
    const {
      upsertPanelServer,
      probePanelConfig,
      recordPanelTest,
      listPanelServersMasked,
      snapshotPanelServer,
      restorePanelServer,
      runFullPanelCheck,
      logPanelEvent,
    } = await import("@/lib/panel-servers.server");
    const actorEmail = (context.claims?.email as string | undefined) ?? null;

    // 1) Sonda rápida ANTES de gravar — nunca trocamos um servidor que
    // funciona por um endereço quebrado.
    let test: { ok: boolean; message: string } | null = null;
    if (!data.skipTest && data.adminKey && data.adminKey.trim()) {
      test = await probePanelConfig(data.baseUrl, data.adminKey);
      if (!test.ok) {
        await logPanelEvent({
          panel: data.panel,
          action: "troca_recusada",
          outcome: "fail",
          message: test.message,
          actorEmail,
          baseUrl: data.baseUrl,
        });
        return { saved: false, test, message: `Não gravei: ${test.message}` };
      }
    }

    // 2) Guarda a configuração atual para poder desfazer.
    const snapshot = await snapshotPanelServer(data.panel);

    await upsertPanelServer({
      panel: data.panel,
      label: data.label,
      baseUrl: data.baseUrl,
      adminKey: data.adminKey ?? null,
      notes: data.notes ?? null,
      isActive: data.isActive,
      actorId: context.userId,
      actorEmail,
    });

    const { refreshPanelOverrides } = await import("@/lib/yaarsa.server");
    await refreshPanelOverrides(true);

    if (test) await recordPanelTest(data.panel, test.ok, test.message);

    // 3) Verificação COMPLETA (simula uma compra real). Se reprovar, volta
    // automaticamente para a configuração anterior.
    let check: Awaited<ReturnType<typeof runFullPanelCheck>> | null = null;
    if (!data.skipTest) {
      check = await runFullPanelCheck(data.panel);
      if (!check.ok) {
        await restorePanelServer(data.panel, snapshot);
        await refreshPanelOverrides(true);
        await logPanelEvent({
          panel: data.panel,
          action: "troca_revertida",
          outcome: "fail",
          message: check.message,
          actorEmail,
          baseUrl: data.baseUrl,
          steps: check.steps,
        });
        return {
          saved: false,
          test,
          check,
          message: `Verificação completa reprovou — desfiz a troca. ${check.message}`,
          rows: await listPanelServersMasked(),
        };
      }
    }

    await logPanelEvent({
      panel: data.panel,
      action: data.skipTest ? "troca_forcada" : "troca_aprovada",
      outcome: "ok",
      message: check?.message ?? "Salvo sem verificação (forçado pelo admin).",
      actorEmail,
      baseUrl: data.baseUrl,
      serverIp: check?.serverIp ?? null,
      steps: check?.steps,
    });

    const rows = await listPanelServersMasked();
    return {
      saved: true,
      test,
      check,
      message: data.skipTest
        ? "Servidor salvo sem verificação (forçado)."
        : "Servidor salvo, verificação completa aprovada e já em uso.",
      rows,
    };
  });

/** Remove o override e volta a usar as variáveis de ambiente. */
export const adminResetPanelServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ panel: panelEnum }).parse(d))
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
  .validator((d: unknown) => z.object({ panel: panelEnum }).parse(d))
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
  .validator((d: unknown) =>
    z
      .object({
        panel: panelEnum,
        baseUrl: z.string().trim().max(300).optional().nullable(),
        adminKey: z.string().trim().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { runFullPanelCheck } = await import("@/lib/panel-servers.server");
    return runFullPanelCheck(data.panel, { baseUrl: data.baseUrl, adminKey: data.adminKey });
  });

/** Registro auditável das verificações e trocas de VPS. */
export const adminPanelServerLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listPanelEvents } = await import("@/lib/panel-servers.server");
    return { events: await listPanelEvents(25) };
  });

/** Qual servidor está escolhido para os próximos testes grátis. */
export const adminGetTrialPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getTrialPanelChoice } = await import("@/lib/app-settings.server");
    const { hasPanelServer, refreshPanelOverrides, resolveTrialPanel } = await import("@/lib/yaarsa.server");
    await refreshPanelOverrides(true);
    const choice = await getTrialPanelChoice(true);
    return {
      choice,
      effective: await resolveTrialPanel(),
      available: {
        v455: hasPanelServer("v455"),
        v457: hasPanelServer("v457"),
        v46: hasPanelServer("v46"),
      },
    };
  });

/** Define em qual servidor os próximos testes grátis serão criados. */
export const adminSetTrialPanel = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ panel: z.enum(["auto", "v455", "v457", "v46"]) }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { setSetting, TRIAL_PANEL_KEY } = await import("@/lib/app-settings.server");
    const { hasPanelServer, refreshPanelOverrides, resolveTrialPanel, panelBaseUrl } =
      await import("@/lib/yaarsa.server");
    await refreshPanelOverrides(true);
    if (data.panel !== "auto" && !hasPanelServer(data.panel)) {
      return { ok: false, message: "Esse servidor ainda não tem endereço configurado." };
    }
    await setSetting(TRIAL_PANEL_KEY, data.panel, context.userId);
    const effective = await resolveTrialPanel();
    const { logPanelEvent } = await import("@/lib/panel-servers.server");
    await logPanelEvent({
      panel: effective,
      action: "trial_panel_definido",
      outcome: "ok",
      message: `Próximos testes grátis passam a ser criados no ${effective}.`,
      actorEmail: (context.claims?.email as string | undefined) ?? null,
      baseUrl: panelBaseUrl(effective),
    }).catch(() => {});
    return { ok: true, choice: data.panel, effective };
  });

/**
 * Últimas falhas de provisionamento de teste grátis (cota cheia, painel fora).
 * Serve de alerta no admin: antes ninguém sabia que a chave tinha batido o
 * limite de contas e os testes falhavam em silêncio.
 */
export const adminTrialProvisionAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getSupabaseAdminSafe } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdminSafe();
    if (!admin) return { alerts: [] as any[] };
    const { data } = await admin
      .from("integration_logs")
      .select("id, created_at, error_message, payload")
      .eq("action", "trial_provision_failed")
      .order("created_at", { ascending: false })
      .limit(10);
    return {
      alerts: (data ?? []).map((r: any) => ({
        id: r.id,
        at: r.created_at,
        reason: r.error_message ?? "",
        limitHit: !!r.payload?.limit_hit,
        panels: (r.payload?.panels ?? []) as string[],
      })),
    };
  });
