import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Identidade curta do usuário logado (foto + apelido) usada no header/painel. */
export const getMyIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email, avatar_url, metadata")
      .eq("id", userId)
      .maybeSingle();

    const meta = ((data?.metadata as any) || {}) as Record<string, any>;
    const isAnonymous = !!meta['is_anonymous'];

    return {
      userId,
      isAnonymous,
      nickname: isAnonymous
        ? "Membro Anônimo"
        : meta['nickname'] || data?.display_name || data?.email?.split("@")[0] || "Operador",
      avatar: isAnonymous ? null : meta['avatar_url'] || data?.avatar_url || null,
      updatedAt: meta['avatar_updated_at'] || null,
    };
  });
