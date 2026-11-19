import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Status do aviso de segurança + quantos códigos de recuperação ainda restam. */
export const getSecurityStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("security_ack_at,recovery_codes_generated_at")
      .eq("id", context.userId)
      .maybeSingle();

    const { count } = await context.supabase
      .from("recovery_codes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("used_at", null);

    return {
      ackAt: (profile as any)?.security_ack_at ?? null,
      generatedAt: (profile as any)?.recovery_codes_generated_at ?? null,
      codesRemaining: count ?? 0,
    };
  });

/** Marca que o cliente já leu o aviso de segurança/anonimato. */
export const ackSecurityNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("profiles")
      .update({ security_ack_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { ok: true };
  });

/** Gera (ou regenera) os códigos de recuperação. Só aqui eles aparecem em texto puro. */
export const generateRecoveryCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generatePlainCode, hashCode, RECOVERY_CODE_COUNT } = await import("@/lib/recovery.server");

    const codes: string[] = [];
    while (codes.length < RECOVERY_CODE_COUNT) {
      const c = generatePlainCode();
      if (!codes.includes(c)) codes.push(c);
    }
    const rows = await Promise.all(
      codes.map(async (c) => ({ user_id: context.userId, code_hash: await hashCode(c) })),
    );

    // Usa o client do próprio usuário (RLS: só mexe nas próprias linhas).
    const db = context.supabase;

    const { error: delErr } = await db.from("recovery_codes").delete().eq("user_id", context.userId);
    if (delErr) throw new Error(`Não foi possível limpar os códigos antigos: ${delErr.message}`);

    const { error } = await db.from("recovery_codes").insert(rows);
    if (error) throw new Error(`Não foi possível gerar os códigos: ${error.message}`);

    await db
      .from("profiles")
      .update({ recovery_codes_generated_at: new Date().toISOString() })
      .eq("id", context.userId);

    return { codes };
  });


/**
 * Recuperação sem e-mail/autenticador: o código é consumido atomicamente,
 * a senha é trocada e os fatores antigos são removidos pela API administrativa.
 */
export const recoverAccountWithCode = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email("E-mail inválido").max(255),
        code: z.string().trim().min(6, "Código inválido").max(40),
        newPassword: z.string().min(8, "Mínimo 8 caracteres").max(72),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { hashCode } = await import("@/lib/recovery.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkRateLimit, recordAttempt } = await import("@/lib/rate-limit.server");
    const { maskEmail } = await import("@/lib/antifraud.server");

    const generic = "E-mail ou código de recuperação inválido.";
    const email = data.email.trim().toLowerCase();
    const emailMasked = maskEmail(email);
    let publicMessage = generic;

    try {
      // O limite mora aqui, e não só na tela: chamar a função direto não o contorna.
      publicMessage = "Não foi possível validar a tentativa agora. Tente novamente.";
      const limit = await checkRateLimit({ key: "recovery", maxAttempts: 3, windowMs: 15 * 60 * 1000 });
      publicMessage = generic;
      if (!limit.allowed) {
        await recordAttempt("recovery", "blocked", emailMasked);
        publicMessage = `Muitas tentativas de recuperação. Tente novamente em ${Math.ceil(limit.retryAfter / 60)} minutos.`;
        throw new Error("rate_limited");
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (profileError) {
        console.error("[recovery] falha ao localizar conta:", profileError.message);
        publicMessage = "Não foi possível recuperar a conta agora. Tente novamente.";
        throw new Error("profile_read");
      }
      if (!profile) throw new Error("invalid_recovery");

      const userId = (profile as { id: string }).id;
      const hash = await hashCode(data.code);
      const claimedAt = new Date().toISOString();

      // O UPDATE condicional devolve a linha para uma única chamada simultânea.
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from("recovery_codes")
        .update({ used_at: claimedAt })
        .eq("user_id", userId)
        .eq("code_hash", hash)
        .is("used_at", null)
        .select("id")
        .maybeSingle();
      if (claimError) {
        console.error("[recovery] falha ao consumir código:", claimError.message);
        publicMessage = "Não foi possível validar o código agora. Tente novamente.";
        throw new Error("claim_failed");
      }
      if (!claimed) throw new Error("invalid_recovery");

      const releaseClaim = async () => {
        const { error } = await supabaseAdmin
          .from("recovery_codes")
          .update({ used_at: null })
          .eq("id", (claimed as { id: string }).id)
          .eq("used_at", claimedAt);
        if (error) console.error("[recovery] falha ao liberar código após erro:", error.message);
      };

      const { data: factorData, error: listError } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
      if (listError) {
        await releaseClaim();
        publicMessage = "Não foi possível conferir o autenticador agora. Nenhuma senha foi alterada.";
        throw new Error("factor_list");
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.newPassword,
        email_confirm: true,
      });
      if (updateError) {
        await releaseClaim();
        publicMessage = "Não foi possível redefinir a senha agora. Nenhuma alteração foi feita.";
        throw new Error("password_update");
      }

      // Um código de recuperação é a prova alternativa de posse da conta.
      // Sem remover os fatores, a senha nova continuaria inútil na tela de 2FA.
      const factors = (factorData?.factors ?? []) as Array<{ id: string }>;
      let removedFactors = 0;
      let factorRemovalFailed = false;
      for (const factor of factors) {
        const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
        if (error) factorRemovalFailed = true;
        else removedFactors += 1;
      }

      const trustedResult = await supabaseAdmin.from("mfa_trusted_devices").delete().eq("user_id", userId);
      if (trustedResult.error) console.error("[recovery] falha ao remover aparelhos:", trustedResult.error.message);

      if (factorRemovalFailed) {
        publicMessage = "A senha foi redefinida, mas não foi possível remover todo o 2FA antigo. Fale com o suporte antes de tentar novamente.";
        throw new Error("factor_removal");
      }

      const { count } = await supabaseAdmin
        .from("recovery_codes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("used_at", null);

      await recordAttempt("recovery", "success", emailMasked);
      return {
        ok: true,
        codesRemaining: count ?? 0,
        mfaRemoved: removedFactors,
        warning: trustedResult.error
          ? "Senha e autenticador atualizados. Remova os aparelhos confiáveis ao entrar novamente."
          : null,
      };
    } catch (error) {
      await recordAttempt("recovery", "failure", emailMasked);
      if ((error as Error)?.message !== "rate_limited") {
        console.error("[recovery] tentativa não concluída:", (error as Error)?.message);
      }
      throw new Error(publicMessage);
    }
  });
