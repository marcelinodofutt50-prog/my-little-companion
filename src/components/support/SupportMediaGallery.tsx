import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Images, Loader2, Paperclip, RotateCw, ExternalLink } from "lucide-react";
import { adminListThreadMessages } from "@/lib/admin.functions";
import { normalizeSupportMessages, type SupportMessage } from "@/lib/support-message";
import { mediaFileName, mediaKind } from "@/lib/support-media";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const filters = [
  { id: "all", label: "Todas" },
  { id: "image", label: "Imagens" },
  { id: "video", label: "Vídeos" },
  { id: "audio", label: "Áudios" },
  { id: "file", label: "Arquivos" },
] as const;
type Filter = (typeof filters)[number]["id"];
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function SupportMediaGallery({ threadId }: { threadId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const generation = useRef(0);
  const list = useServerFn(adminListThreadMessages);

  useEffect(() => {
    if (!open) return;
    const request = ++generation.current;
    let cancelled = false;
    setItems([]);
    setSelected(null);
    setError(false);
    setFilter("all");
    setLoading(true);
    const scan = async () => {
      let before: string | undefined;
      const collected = new Map<string, SupportMessage>();
      try {
        while (!cancelled && generation.current === request) {
          const result = await list({ data: { threadId, limit: 100, before } });
          if (cancelled || generation.current !== request) return;
          const messages = normalizeSupportMessages(result.messages, threadId);
          for (const message of messages) {
            if (message.thread_id === threadId && message.attachment_url) collected.set(message.id, message);
          }
          setItems(Array.from(collected.values()).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)));
          if (!result.hasMore) break;
          const next = messages[0]?.created_at;
          if (!next || next === before) throw new Error("Histórico incompleto");
          before = next;
        }
      } catch {
        if (!cancelled && generation.current === request) setError(true);
      } finally {
        if (!cancelled && generation.current === request) setLoading(false);
      }
    };
    void scan();
    return () => { cancelled = true; };
  }, [open, threadId, retry, list]);

  const visible = items.filter((item) => {
    const kind = mediaKind(item.attachment_type, item.attachment_url);
    return filter === "all" || kind === filter || (filter === "file" && kind === "pdf");
  });

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setOpen(true)} title="Ver mídias desta conversa">
        <Images className="h-3.5 w-3.5" /> Mídias
      </Button>
      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setSelected(null); }}>
        <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden">
          <DialogHeader className="pr-6">
            <DialogTitle>Mídias da conversa</DialogTitle>
            <DialogDescription>{items.length} anexo{items.length === 1 ? "" : "s"}{loading ? " · Buscando no histórico…" : ""}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar mídias">
            {filters.map((option) => <Button key={option.id} type="button" size="sm" variant={filter === option.id ? "secondary" : "ghost"} aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}</Button>)}
          </div>
          {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">Não foi possível carregar todo o histórico.<Button type="button" size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}><RotateCw className="mr-1 h-3.5 w-3.5" />Tentar novamente</Button></div>}
          <div className="min-h-0 overflow-y-auto" data-sensitive>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((item) => {
                const url = item.attachment_url;
                if (!url) return null;
                const kind = mediaKind(item.attachment_type, url);
                const name = mediaFileName(url);
                const date = new Date(item.created_at);
                return <article key={item.id} className="min-w-0 overflow-hidden rounded-md border border-border bg-card">
                  <div className="flex h-40 items-center justify-center overflow-hidden bg-muted/30 p-2">
                    {kind === "image" ? <Button type="button" variant="ghost" className="h-full w-full p-0" aria-label={`Ampliar ${name}`} onClick={() => setSelected(item)}><img src={url} alt={name} loading="lazy" className="h-full w-full object-contain" /></Button>
                      : kind === "video" ? <video src={url} controls preload="metadata" playsInline className="h-full w-full object-contain" />
                      : kind === "audio" ? <audio src={url} controls preload="none" className="w-full" />
                      : <Paperclip className="h-8 w-8 text-muted-foreground" />}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate text-xs font-medium" title={name}>{name}</p>
                    <p className="text-xs text-muted-foreground">{item.is_admin ? "Equipe" : "Cliente"} · {Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date)}</p>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4"><ExternalLink className="h-3 w-3" />Abrir arquivo</a>
                  </div>
                </article>;
              })}
            </div>
            {loading && <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando mídias…</div>}
            {!loading && !error && visible.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{items.length ? "Nenhuma mídia neste filtro." : "Nenhuma mídia enviada nesta conversa."}</p>}
          </div>
          <Dialog open={selected !== null} onOpenChange={(value) => { if (!value) setSelected(null); }}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-4xl">
              <DialogHeader className="min-w-0 pr-6"><DialogTitle className="break-all">{mediaFileName(selected?.attachment_url)}</DialogTitle><DialogDescription>Imagem da conversa</DialogDescription></DialogHeader>
              {selected?.attachment_url && <div data-sensitive><img src={selected.attachment_url} alt={mediaFileName(selected.attachment_url)} className="max-h-[65dvh] w-full object-contain" /></div>}
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </>
  );
}