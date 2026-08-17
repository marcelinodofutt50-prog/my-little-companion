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

  // O bucket é privado: só o servidor (service role) consegue assinar de forma confiável.
  try {
    const { signTutorialMedia } = await import("@/lib/public-tutorials.functions");
    const res = await signTutorialMedia({ data: { path } });
    if (res?.url) {
      cache.set(path, res.url);
      return res.url;
    }
  } catch (e) {
    console.warn("[tutorial-media] Assinatura no servidor falhou:", e);
  }

  // Fallback: tenta assinar no browser (funciona quando há policy de leitura)
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.storage.from("tutorials").createSignedUrl(path, 60 * 60 * 4);
    if (!error && data?.signedUrl) {
      cache.set(path, data.signedUrl);
      return data.signedUrl;
    }
    console.warn("[tutorial-media] Falha ao assinar mídia:", error?.message);
  } catch (e) {
    console.warn("[tutorial-media] Fallback de assinatura falhou:", e);
  }
  return url;
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
