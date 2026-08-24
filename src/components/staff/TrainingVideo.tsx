import { ExternalLink, Video } from "lucide-react";

/**
 * Player embutido para os vídeos dos módulos de treinamento.
 * Antes existia apenas um link "Assistir vídeo" — links do YouTube/Drive abriam
 * outra aba (ou eram bloqueados), e o time achava que o sistema estava quebrado.
 */
function toEmbed(url: string): { kind: "iframe" | "video" | "link"; src: string } {
  const raw = (url || "").trim();
  if (!raw) return { kind: "link", src: raw };

  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return { kind: "iframe", src: `https://www.youtube.com/embed/${u.pathname.slice(1)}` };
    }
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
      if (u.pathname.startsWith("/embed/")) return { kind: "iframe", src: raw };
      if (id) return { kind: "iframe", src: `https://www.youtube.com/embed/${id}` };
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` };
    }
    if (host.endsWith("drive.google.com")) {
      const id = raw.match(/\/d\/([^/]+)/)?.[1] ?? u.searchParams.get("id");
      if (id) return { kind: "iframe", src: `https://drive.google.com/file/d/${id}/preview` };
    }
    if (host.endsWith("loom.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return { kind: "iframe", src: `https://www.loom.com/embed/${id}` };
    }
    if (/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(u.pathname)) {
      return { kind: "video", src: raw };
    }
  } catch {
    return { kind: "link", src: raw };
  }
  return { kind: "link", src: raw };
}

export function TrainingVideo({ url }: { url: string }) {
  const { kind, src } = toEmbed(url);

  return (
    <div className="space-y-2">
      {kind === "iframe" && (
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-primary/20 bg-black">
          <iframe
            src={src}
            title="Vídeo do módulo de treinamento"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        </div>
      )}

      {kind === "video" && (
        <video
          src={src}
          controls
          preload="metadata"
          playsInline
          className="w-full rounded-xl border border-primary/20 bg-black"
        >
          <track kind="captions" />
        </video>
      )}

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary"
      >
        {kind === "link" ? <Video className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
        {kind === "link" ? "Assistir vídeo do módulo" : "Abrir em nova aba"}
      </a>
    </div>
  );
}
