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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const codes: string[] = [];
    while (codes.length < RECOVERY_CODE_COUNT) {
      const c = generatePlainCode();
      if (!codes.includes(c)) codes.push(c);
    }
    const rows = await Promise.all(
      codes.map(async (c) => ({ user_id: context.userId, code_hash: await hashCode(c) })),
    );

    await supabaseAdmin.from("recovery_codes").delete().eq("user_id", context.userId);
    const { error } = await supabaseAdmin.from("recovery_codes").insert(rows);
    if (error) throw new Error("Não foi possível gerar os códigos agora. Tente novamente.");

    await supabaseAdmin
      .from("profiles")
      .update({ recovery_codes_generated_at: new Date().toISOString() })
      .eq("id", context.userId);

    return { codes };
  });

/**
 * Recuperação de conta sem acesso ao e-mail: exige um código de backup válido.
 * Mensagens propositalmente genéricas para não revelar se o e-mail existe.
 */
export const recoverAccountWithCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email("E-mail inválido").max(255),
        code: z.string().trim().min(6, "Código inválido").max(40),
        newPassword: z.string().min(6, "Mínimo 6 caracteres").max(72),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { hashCode } = await import("@/lib/recovery.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const generic = "E-mail ou código de recuperação inválido.";
    const email = data.email.trim().toLowerCase();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (!profile) throw new Error(generic);

    const hash = await hashCode(data.code);
    const { data: row } = await supabaseAdmin
      .from("recovery_codes")
      .select("id")
      .eq("user_id", (profile as any).id)
      .eq("code_hash", hash)
      .is("used_at", null)
      .maybeSingle();
    if (!row) throw new Error(generic);

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById((profile as any).id, {
      password: data.newPassword,
      email_confirm: true,
    });
    if (updErr) throw new Error("Não foi possível redefinir a senha agora. Tente novamente.");

    await supabaseAdmin
      .from("recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", (row as any).id);

    const { count } = await supabaseAdmin
      .from("recovery_codes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", (profile as any).id)
      .is("used_at", null);

    return { ok: true, codesRemaining: count ?? 0 };
  });
