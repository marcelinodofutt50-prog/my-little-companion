import { useEffect, useState } from "react";

/**
 * O bucket `tutorials` é privado. URLs "públicas" salvas no banco
 * (…/storage/v1/object/public/tutorials/<path>) não abrem sem token.
 * Aqui convertemos qualquer URL/caminho do bucket em uma URL assinada válida.
 */
export function extractTutorialPath(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/tutorials\/([^?]+)/);
  if (match) return decodeURIComponent(match[1]);
  // Caminho puro salvo diretamente (ex: "tutorials/123.mp4")
  if (!/^https?:\/\//i.test(url)) return url.replace(/^tutorials\//, "tutorials/");
  return null;
}

const cache = new Map<string, string>();

export async function resolveTutorialMedia(url?: string | null): Promise<string | null> {
  if (!url) return null;
  const path = extractTutorialPath(url);
  if (!path) return url; // YouTube ou host externo
  const cached = cache.get(path);
  if (cached) return cached;

  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.storage.from("tutorials").createSignedUrl(path, 60 * 60 * 4);
  if (error || !data?.signedUrl) {
    console.warn("[tutorial-media] Falha ao assinar mídia:", error?.message);
    return url;
  }
  cache.set(path, data.signedUrl);
  return data.signedUrl;
}

/** Hook que devolve a URL utilizável (assinada quando necessário). */
export function useTutorialMedia(url?: string | null): string | null {
  const [resolved, setResolved] = useState<string | null>(() =>
    url && !extractTutorialPath(url) ? url : null
  );

  useEffect(() => {
    let active = true;
    if (!url) {
      setResolved(null);
      return;
    }
    resolveTutorialMedia(url).then((next) => {
      if (active) setResolved(next);
    });
    return () => {
      active = false;
    };
  }, [url]);

  return resolved;
}
