import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Equipe: cria um lote de códigos de cortesia. */
export const staffCreateRedeemCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      kind: z.enum(["license_days", "server_renewal"]),
      days: z.number().int().min(1).max(365).optional(),
      planSlug: z.enum(["login-7d", "login-30d", "login-lifetime"]).optional(),
      quantity: z.number().int().min(1).max(50).default(1),
      maxUses: z.number().int().min(1).max(500).default(1),
      validForDays: z.number().int().min(1).max(365).default(30),
      note: z.string().trim().max(200).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateRedeemCode } = await import("./redeem-rules");

    if (data.kind === "license_days" && !data.days) {
      throw new Error("Informe quantos dias o código vale.");
    }

    const expiresAt = new Date(Date.now() + data.validForDays * 86400000).toISOString();
    const rows = Array.from({ length: data.quantity }, () => ({
      code: generateRedeemCode(),
      kind: data.kind,
      days: data.kind === "license_days" ? data.days! : null,
      plan_slug: data.kind === "license_days" ? (data.planSlug ?? "login-30d") : null,
      max_uses: data.maxUses,
      expires_at: expiresAt,
      note: data.note ?? null,
      created_by: context.userId,
    }));

    const { data: created, error } = await supabaseAdmin
      .from("redeem_codes" as any).insert(rows as any).select("*");
    if (error) throw new Error(error.message);
    return { ok: true, codes: created ?? [] };
  });

/** Equipe: lista códigos + histórico de uso. */
export const staffListRedeemCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: codes } = await supabaseAdmin
      .from("redeem_codes" as any).select("*").order("created_at", { ascending: false }).limit(200);
    const { data: uses } = await supabaseAdmin
      .from("redeem_code_uses" as any).select("*").order("created_at", { ascending: false }).limit(100);
    return { codes: codes ?? [], uses: uses ?? [] };
  });

/** Equipe: liga/desliga um código. */
export const staffToggleRedeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("redeem_codes" as any).update({ active: data.active } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cliente: consulta o que um código faz, antes de resgatar. */
export const previewRedeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ code: z.string().trim().min(4).max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeRedeemCode, checkRedeemCode, describeRedeemCode } = await import("./redeem-rules");

    const code = normalizeRedeemCode(data.code);
    const { data: row } = await supabaseAdmin
      .from("redeem_codes" as any).select("*").eq("code", code).maybeSingle();
    const check = checkRedeemCode(row as any);
    if (!check.ok) return { ok: false as const, message: check.message };
    if ((row as any).target_user_id && (row as any).target_user_id !== context.userId) {
      return { ok: false as const, message: "Este código pertence a outro membro." };
    }
    return {
      ok: true as const,
      kind: (row as any).kind as string,
      days: (row as any).days as number | null,
      needsLicense: (row as any).kind === "server_renewal",
      description: describeRedeemCode(row as any),
    };
  });

/** Cliente: resgata o código (dias de licença ou renovação de servidor). */
export const redeemMyCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      code: z.string().trim().min(4).max(40),
      licenseId: z.string().uuid().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeRedeemCode } = await import("./redeem-rules");
    const { applyServerRenewalCode, applyDaysToLicense, createCourtesyLicense } =
      await import("./redeem.server");
    const { withOpLock, recordLicenseAudit } = await import("./audit-trail.server");

    const code = normalizeRedeemCode(data.code);

    return await withOpLock(
      `redeem:${userId}:${code}`,
      async () => {
        const { data: reservation, error: reservationError } = await supabaseAdmin.rpc(
          "reserve_redeem_code",
          { _code: code, _user_id: userId },
        );
        if (reservationError) throw new Error(reservationError.message);
        const rc = reservation?.[0];
        if (!rc) throw new Error("Não foi possível reservar este código agora.");

        const rollback = async () => {
          const { error } = await supabaseAdmin.rpc("release_redeem_code_claim", {
            _claim_id: rc.claim_id,
            _user_id: userId,
          });
          if (error) console.error("[Redeem] Falha ao liberar reserva:", error.message);
        };

        let license: any = null;
        if (data.licenseId) {
          const { data: lic } = await supabaseAdmin
            .from("licenses").select("*")
            .eq("id", data.licenseId).eq("user_id", userId).is("disabled_at", null).maybeSingle();
          if (!lic) { await rollback(); throw new Error("Licença não encontrada na sua conta."); }
          license = lic;
        }

        try {
          let outcome;
          if (rc.kind === "server_renewal") {
            if (!license) throw new Error("Escolha qual licença deve receber a renovação do servidor.");
            if (license.is_trial) throw new Error("O teste grátis não paga servidor — escolha uma licença paga.");
            outcome = await applyServerRenewalCode(license);
          } else if (license && !license.is_trial) {
            outcome = await applyDaysToLicense(license, Number(rc.days ?? 1));
          } else {
            outcome = await createCourtesyLicense(userId, Number(rc.days ?? 1), rc.plan_slug ?? "login-30d");
          }

          await supabaseAdmin.from("redeem_code_uses").update({
            license_id: outcome.licenseId,
            details: { status: "applied", kind: rc.kind, days: rc.days, expires_at: outcome.expires_at },
          }).eq("id", rc.claim_id);

          await recordLicenseAudit({
            licenseId: outcome.licenseId,
            userId,
            actorId: userId,
            actorKind: "customer",
            eventType: rc.kind === "server_renewal" ? "coupon_server_renewal" : "coupon_license_days",
            reason: `Código de cortesia ${code}${rc.note ? ` — ${rc.note}` : ""}`,
            yaarsaEmail: license?.yaarsa_email ?? null,
            panel: license?.panel ?? null,
            expiresBefore: license?.expires_at ?? null,
            expiresAfter: outcome.expires_at,
            details: { code, code_id: rc.code_id, days: rc.days, created_license: outcome.created },
          });

          return { ok: true, ...outcome };
        } catch (e: any) {
          await rollback();
          throw new Error(e?.message ?? "Não foi possível aplicar o código agora.");
        }
      },
      { ttlSeconds: 90, busyMessage: "Seu resgate já está sendo processado. Aguarde alguns segundos." },
    );
  });

