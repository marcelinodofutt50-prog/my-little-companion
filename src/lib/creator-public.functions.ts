import { createServerFn } from "@tanstack/react-start";
import { safeCreatorVideoHref } from "./creator-link-safety";

export type PublicCreatorVideo = { href: string; title: string; platform: string; creator: string };

/**
 * Vídeos de creator APROVADOS para a vitrine pública (/creators).
 * Roda no servidor com supabaseAdmin (sem RLS), mas devolve só campos seguros:
 * URL validada pelo creator-link-safety, título, plataforma e o display_name do
 * creator (nunca nome real/e-mail). Prova social que converte quem chega no site.
 */
export const getPublicCreatorVideos = createServerFn({ method: "GET" }).handler(async (): Promise<PublicCreatorVideo[]> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vids, error } = await supabaseAdmin
      .from("creator_videos")
      .select("url, title, platform, user_id, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(18);
    if (error || !vids?.length) return [];

    const ids = Array.from(new Set((vids as any[]).map((r) => r.user_id).filter(Boolean)));
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, display_name").in("id", ids);
    // Só display_name público; nunca full_name/e-mail. Sem apelido -> genérico.
    const nameOf = new Map((profs ?? []).map((p: any) => [p.id, (p.display_name || "").toString().trim()]));

    return (vids as any[])
      .map((r) => {
        const href = safeCreatorVideoHref(String(r.url ?? ""));
        if (!href) return null;
        const creator = (nameOf.get(r.user_id) || "Creator Shadow").slice(0, 40);
        return { href, title: String(r.title ?? "").slice(0, 120), platform: String(r.platform ?? ""), creator };
      })
      .filter((v): v is PublicCreatorVideo => v !== null)
      .slice(0, 9);
  } catch {
    return [];
  }
});
