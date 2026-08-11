import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * SHADOW NEXUS v2.0
 * Leitura sem embed do PostgREST (community_messages.user_id possui 2 FKs:
 * auth.users e profiles -> o hint "profiles!user_id" era ambíguo e derrubava
 * o chat inteiro, deixando a Central da Comunidade "sincronizando" para sempre).
 * Agora buscamos mensagens e perfis em duas queries e juntamos em memória.
 */
export const getCommunityMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("community_messages")
      .select("id, content, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error("[Nexus] Falha ao carregar mensagens:", error.message);
      return { messages: [], online: 0, error: error.message };
    }

    const list = rows || [];
    const ids = Array.from(new Set(list.map((m) => m.user_id)));

    let profileMap = new Map<string, any>();
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, full_name, email, metadata, vip_tier")
        .in("id", ids);
      profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    }

    // "Online": autores distintos nos últimos 15 minutos
    const cutoff = Date.now() - 15 * 60 * 1000;
    const online = new Set(
      list.filter((m) => new Date(m.created_at).getTime() > cutoff).map((m) => m.user_id),
    ).size;

    const messages = list.map((m) => {
      const p = profileMap.get(m.user_id) || {};
      const meta = (p.metadata as any) || {};
      const anonymous = !!meta.is_anonymous;
      return {
        id: m.id,
        content: m.content,
        created_at: m.created_at,
        isMine: m.user_id === userId,
        anonymous,
        author: anonymous
          ? "Agente Anônimo"
          : meta.nickname || p.display_name || p.full_name || p.email?.split("@")[0] || "Membro",
        avatar: anonymous ? null : meta.avatar_url || null,
        vip: anonymous ? "none" : p.vip_tier || "none",
      };
    });

    return { messages, online, error: null };
  });

export const sendCommunityMessage = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ content: z.string().trim().min(1).max(500) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Anti-flood simples: máx. 5 mensagens por minuto
    const since = new Date(Date.now() - 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("community_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);

    if ((count || 0) >= 5) {
      throw new Error("Muitas transmissões seguidas. Aguarde alguns segundos.");
    }

    const { error } = await supabaseAdmin
      .from("community_messages")
      .insert({ user_id: userId, content: data.content });

    if (error) throw new Error("Erro ao enviar mensagem: " + error.message);
    return { ok: true };
  });

export const deleteCommunityMessage = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("community_messages")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCommunityGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("community_goals")
      .select("*")
      .order("target_members", { ascending: true });
    return data || [];
  });
