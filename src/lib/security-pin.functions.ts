import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/admin-helpers.server";

/** PIN de segurança do próprio cliente (Shadow Pass e cantinho do chat). */
export const getMySecurityPin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSupabaseAdminSafe } = await import("./supabase-admin.server");
    const admin = await getSupabaseAdminSafe();
    if (!admin) return { pin: null as string | null, rotatedAt: null, lastUsedAt: null };
    const { getOrCreatePin } = await import("./security-pin.server");
    return await getOrCreatePin(admin, context.userId);
  });

/** O cliente pode invalidar o PIN atual quando quiser. */
export const rotateMySecurityPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSupabaseAdminSafe } = await import("./supabase-admin.server");
    const admin = await getSupabaseAdminSafe();
    if (!admin) throw new Error("Serviço de segurança indisponível agora. Tente de novo em instantes.");
    const { rotatePin } = await import("./security-pin.server");
    return { pin: await rotatePin(admin, context.userId) };
  });

/** Histórico de consultas feitas pela equipe usando o PIN (visível ao cliente). */
export const listMyPinReveals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("pin_reveal_logs")
      .select("id, created_at, staff_email, scope, success")
      .order("created_at", { ascending: false })
      .limit(20);
    return { reveals: data ?? [] };
  });

/**
 * Equipe: revela os acessos das licenças do cliente mediante o PIN dele.
 * PIN correto → dados liberados, PIN queimado e novo gerado, tudo auditado.
 */
export const staffRevealLicenseAccess = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ userId: z.string().uuid(), pin: z.string().max(24).optional() }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertStaff(context);

    const { getSupabaseAdminSafe } = await import("./supabase-admin.server");
    const admin = await getSupabaseAdminSafe();
    if (!admin) throw new Error("Serviço de segurança indisponível agora. Tente de novo em instantes.");

    const { verifyAndConsumePin, logPinReveal, hasActiveChatGrant } = await import("./security-pin.server");
    const staffEmail = (context.claims?.["email"] as string | undefined) ?? null;

    // O cliente pode ter liberado a consulta enviando o PIN no próprio chat:
    // nesse caso o PIN já foi queimado lá e a equipe segue sem digitar nada.
    const provided = (data.pin ?? "").replace(/[^A-Za-z0-9]/g, "");
    const granted = provided.length < 4 ? await hasActiveChatGrant(admin, data.userId) : false;
    if (provided.length < 4 && !granted) {
      return {
        ok: false as const,
        message: "Peça o PIN ao cliente (ou peça para ele enviar o PIN aqui no chat para liberar).",
      };
    }

    const check = granted ? ({ ok: true } as const) : await verifyAndConsumePin(admin, data.userId, provided);
    if (!check.ok) {
      await logPinReveal(admin, {
        userId: data.userId,
        staffId: context.userId,
        staffEmail,
        success: false,
        details: { reason: check.reason },
      });
      const msg =
        check.reason === "no_pin"
          ? "Esse cliente ainda não tem PIN gerado. Peça para ele abrir o Shadow Pass."
          : "PIN incorreto ou já utilizado. Peça o PIN atual ao cliente (ele muda a cada consulta).";
      return { ok: false as const, message: msg };
    }

    const { data: licenses } = await admin
      .from("licenses")
      .select("id, yaarsa_email, yaarsa_password_enc, plan_slug, panel, expires_at, revoked, disabled_at, is_trial")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { decrypt } = await import("./yaarsa.server");
    const rows = (licenses ?? []).map((l: any) => {
      let password: string | null = null;
      try {
        password = l.yaarsa_password_enc ? decrypt(l.yaarsa_password_enc) : null;
      } catch {
        password = null;
      }
      return {
        id: l.id,
        email: l.yaarsa_email,
        password,
        planSlug: l.plan_slug,
        panel: l.panel,
        expiresAt: l.expires_at,
        active: !l.revoked && !l.disabled_at,
        isTrial: !!l.is_trial,
      };
    });

    await logPinReveal(admin, {
      userId: data.userId,
      staffId: context.userId,
      staffEmail,
      success: true,
      details: { licenses: rows.length },
    });

    return { ok: true as const, licenses: rows };
  });

/** Admin: histórico de consultas feitas com PIN em um cliente. */
export const adminListPinReveals = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { getSupabaseAdminSafe } = await import("./supabase-admin.server");
    const admin = await getSupabaseAdminSafe();
    if (!admin) return { reveals: [] as any[] };
    const { data: rows } = await admin
      .from("pin_reveal_logs")
      .select("id, created_at, staff_email, success, details")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { reveals: rows ?? [] };
  });
