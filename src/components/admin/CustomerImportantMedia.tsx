import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Paperclip, RotateCw, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminListImportantMedia, adminSetImportantMedia } from "@/lib/important-media.functions";
import type { ImportantMediaItem } from "@/lib/important-media";
import { mediaFileName, mediaKind } from "@/lib/support-media";

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Mídias que a equipe marcou como importantes nas conversas deste cliente (privado). */
export function CustomerImportantMedia({ userId, onOpenThread }: { userId: string; onOpenThread?: (threadId: string) => void }) {
  const list = useServerFn(adminListImportantMedia);
  const setMarked = useServerFn(adminSetImportantMedia);
  const [items, setItems] = useState<ImportantMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const gen = useRef(0);

  const load = async () => {
    const request = ++gen.current;
    setLoading(true); setError(false);
    try {
      const r = await list({ data: { userId } });
      if (gen.current === request) { setItems(r.items); setTruncated(r.truncated); }
    } catch {
      if (gen.current === request) setError(true);
    } finally {
      if (gen.current === request) setLoading(false);
    }
  };

  useEffect(() => {
    setItems([]);
    setTruncated(false);
    setBusy(null);
    void load();
    return () => { gen.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const remove = async (messageId: string) => {
    if (busy) return;
    const request = gen.current;
    setBusy(messageId);
    try {
      await setMarked({ data: { messageId, important: false } });
      if (gen.current !== request) return;
      setItems((cur) => cur.filter((i) => i.messageId !== messageId));
      toast.success("Destaque removido");
    } catch (e: any) {
      if (gen.current !== request) return;
      toast.error(e?.message === "Forbidden" ? "Somente administradores podem alterar destaques." : "Não foi possível remover o destaque.");
    } finally {
      if (gen.current === request) setBusy(null);
    }
  };

  return (
    <div className="space-y-1.5" data-sensitive>
      {loading && items.length === 0 && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Carregando…</p>}
      {error && <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive">Não foi possível carregar as mídias importantes.<Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => void load()}><RotateCw className="mr-1 h-3 w-3" />Tentar novamente</Button></div>}
      {!loading && !error && items.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma mídia importante.</p>}
      {truncated && <p className="text-[11px] text-muted-foreground">Mostrando as mídias marcadas mais recentes; há mais no histórico deste cliente.</p>}
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const kind = mediaKind(item.attachmentType, item.attachmentUrl);
          const name = mediaFileName(item.attachmentUrl);
          const sent = new Date(item.sentAt);
          return (
            <article key={item.messageId} className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card/40">
              <div className="flex h-28 items-center justify-center bg-muted/30 p-1">
                {kind === "image" ? <img src={item.attachmentUrl} alt={name} loading="lazy" className="h-full w-full object-contain" /> : <Paperclip className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate text-[11px] font-medium" title={name}>{name}</p>
                <p className="text-[10px] text-muted-foreground">{item.fromStaff ? "Equipe" : "Cliente"} · {Number.isNaN(sent.getTime()) ? "" : fmt.format(sent)}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary underline underline-offset-4"><ExternalLink className="h-3 w-3" />Abrir</a>
                  {onOpenThread && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => onOpenThread(item.threadId)}>Conversa</Button>}
                  <Button size="sm" variant="ghost" className="ml-auto h-6 gap-1 px-1.5 text-[11px]" disabled={busy !== null} onClick={() => void remove(item.messageId)} title="Remover destaque">
                    {busy === item.messageId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3 fill-current" />}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
