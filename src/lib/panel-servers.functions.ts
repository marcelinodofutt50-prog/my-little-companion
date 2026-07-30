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
    const { panelBaseUrl, refreshPanelOverrides } = await import("@/lib/yaarsa.server");
    await refreshPanelOverrides(true);
    const rows = await listPanelServersMasked();
    const effective = {
      v457: panelBaseUrl("v457"),
      v46: panelBaseUrl("v46"),
    };
    const envFallback = {
      v457: (process.env.YAARSA_BASE_URL || "").trim() || null,
      v46: (process.env.YAARSA_V46_BASE_URL || "").trim() || null,
    };
    return { rows, effective, envFallback };
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
