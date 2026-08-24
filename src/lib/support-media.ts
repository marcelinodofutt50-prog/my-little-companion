/**
 * Utilitários de mídia do chat de suporte.
 *
 * O link do anexo é salvo já assinado no banco, e link assinado vence. Para o
 * anexo nunca "sumir" depois de alguns dias, extraímos o caminho do arquivo do
 * próprio link e geramos um link novo na hora de exibir.
 */

export const SUPPORT_MEDIA_BUCKET = "support-media";
export const SUPPORT_MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export const SUPPORT_MEDIA_SIGNED_TTL = 60 * 60 * 6;

/** Extrai `user/thread/arquivo.png` de uma URL assinada/pública do bucket. */
export function extractSupportMediaPath(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes("://")) return url.replace(/^\/+/, "") || null;
  const marker = `/${SUPPORT_MEDIA_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const raw = url.slice(idx + marker.length).split("?")[0] ?? "";
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Nome de arquivo seguro para chave de storage (sem acento, espaço ou símbolo). */
export function safeMediaFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name) || "arquivo";
  const ext = (dot > 0 ? name.slice(dot + 1) : "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);
  return `${cleanBase || "arquivo"}${ext ? `.${ext}` : ""}`;
}

export type MediaKind = "image" | "video" | "audio" | "pdf" | "file";

/** Descobre o tipo de mídia pelo MIME e, se faltar, pela extensão. */
export function mediaKind(type: string | null | undefined, url?: string | null): MediaKind {
  const t = (type ?? "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf") return "pdf";
  const path = (extractSupportMediaPath(url) ?? "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|bmp|heic)$/.test(path)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return "video";
  if (/\.(mp3|ogg|wav|m4a|opus|aac)$/.test(path)) return "audio";
  if (/\.pdf$/.test(path)) return "pdf";
  return "file";
}

/** Nome amigável do anexo para exibir na bolha. */
export function mediaFileName(url: string | null | undefined): string {
  const path = extractSupportMediaPath(url);
  if (!path) return "anexo";
  const last = path.split("/").pop() ?? "anexo";
  return last.replace(/^\d{10,}-/, "");
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
