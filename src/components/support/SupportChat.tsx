import { useEffect, useRef, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listMessages,
  sendMessage,
  markThreadReadByCustomer,
} from "@/lib/support.functions";
import {
  normalizeSupportMessage,
  normalizeSupportMessages,
  SupportMessage,
} from "@/lib/support-message";
import {
  Send,
  Paperclip,
  Loader2,
  Clock,
  RotateCw,
  User,
  ShieldCheck,
  Bot,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { playNotifyDing } from "@/lib/notify-sound";

type PendingMsg = {
  clientId: string;
  body: string | null;
  attachmentPath?: string;
  attachmentType?: string;
  status: "sending" | "failed";
  error?: string;
  created_at: string;
};

interface SupportChatProps {
  threadId: string;
  userId: string;
  isAdmin?: boolean;
  onNewMessage?: () => void;
}

type Group = {
  key: string;
  dayLabel: string;
  author: "me" | "staff" | "system";
  authorLabel: string;
  messages: SupportMessage[];
};

const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hoje";
  if (same(d, yesterday)) return "Ontem";
  return dayFormatter.format(d);
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Agrupa por dia e por autor em sequência — evita a poluição de cabeçalho por mensagem. */
function groupMessages(msgs: SupportMessage[], userId: string): Group[] {
  const groups: Group[] = [];
  for (const m of msgs) {
    const author: Group["author"] = m.is_system ? "system" : m.sender_id === userId ? "me" : "staff";
    const label = m.is_system ? "Assistente Shadow" : author === "me" ? "Você" : "Suporte Shadow";
    const day = dayLabel(m.created_at);
    const last = groups[groups.length - 1];
    const withinWindow =
      last &&
      last.author === author &&
      last.dayLabel === day &&
      new Date(m.created_at).getTime() -
        new Date(last.messages[last.messages.length - 1]!.created_at).getTime() <
        5 * 60 * 1000;
    if (withinWindow) {
      last!.messages.push(m);
    } else {
      groups.push({ key: m.id || `${author}-${m.created_at}`, dayLabel: day, author, authorLabel: label, messages: [m] });
    }
  }
  return groups;
}

export function SupportChat({ threadId, userId, isAdmin = false, onNewMessage }: SupportChatProps) {
  const [msgs, setMsgs] = useState<SupportMessage[]>([]);
  const [pending, setPending] = useState<PendingMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);

  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const markReadFn = useServerFn(markThreadReadByCustomer);

  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => groupMessages(msgs, userId), [msgs, userId]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior });
    setUnseen(0);
  };

  const loadMessages = async (before?: string) => {
    try {
      const r: any = await listFn({ data: { threadId, limit: 30, before } });
      const newMsgs = normalizeSupportMessages(r.messages, threadId);
      if (before) {
        setMsgs((prev) => [...newMsgs, ...prev]);
      } else {
        setMsgs(newMsgs);
      }
      setHasMore(!!r.hasMore);
    } catch (e: any) {
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setMsgs([]);
    setUnseen(0);
    loadMessages();
    if (!isAdmin) {
      markReadFn({ data: { threadId } }).catch(() => {});
    }

    const ch = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const next = normalizeSupportMessage(payload.new, threadId);
          setMsgs((prev) => {
            if (prev.some((m) => m.id === next.id)) return prev;
            if (next.sender_id !== userId) {
              playNotifyDing();
              onNewMessage?.();
              if (!atBottom) setUnseen((u) => u + 1);
            }
            return [...prev, next];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [threadId, userId]);

  useEffect(() => {
    if (!loadingOlder && atBottom) scrollToBottom();
  }, [msgs.length, pending.length]);

  const handleSend = async (attachmentPath?: string, attachmentType?: string, retryOf?: string) => {
    const text = retryOf ? (pending.find((p) => p.clientId === retryOf)?.body ?? "") : body.trim();
    if (!text && !attachmentPath) return;

    const clientId = retryOf ?? `local-${Date.now()}`;
    const newPending: PendingMsg = {
      clientId,
      body: text || null,
      attachmentPath,
      attachmentType,
      status: "sending",
      created_at: new Date().toISOString(),
    };

    setPending((prev) =>
      retryOf ? prev.map((p) => (p.clientId === retryOf ? newPending : p)) : [...prev, newPending],
    );
    if (!retryOf) setBody("");

    try {
      const res: any = await sendFn({
        data: { threadId, body: text || undefined, attachmentPath, attachmentType },
      });
      setMsgs((prev) => {
        const normalized = normalizeSupportMessage(res, threadId);
        if (prev.some((m) => m.id === normalized.id)) return prev;
        return [...prev, normalized];
      });
      setPending((prev) => prev.filter((p) => p.clientId !== clientId));
      setAtBottom(true);
    } catch (e: any) {
      const message = e?.message || "Falha ao enviar a mensagem.";
      setPending((prev) =>
        prev.map((p) => (p.clientId === clientId ? { ...p, status: "failed", error: message } : p)),
      );
      toast.error(message);
    }
  };

  const bubbleClass = (author: Group["author"]) =>
    author === "system"
      ? "bg-cyan/10 border border-cyan/40 text-cyan"
      : author === "me"
        ? "bg-primary text-primary-foreground"
        : "bg-muted/50 border border-border/40";

  return (
    <div className="relative flex flex-col h-full bg-background/40 backdrop-blur-sm border border-border/40 rounded-lg overflow-hidden">
      <SupportSummaryPanel threadId={threadId} />
      <div

        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          setAtBottom(bottom);
          if (bottom) setUnseen(0);
        }}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-5"
      >
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-[10px] uppercase font-mono"
            onClick={() => {
              setLoadingOlder(true);
              loadMessages(msgs[0]?.created_at);
            }}
          >
            {loadingOlder ? <Loader2 className="animate-spin h-3 w-3" /> : "Carregar histórico"}
          </Button>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-xs font-mono uppercase text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa
          </div>
        )}

        {!loading && msgs.length === 0 && pending.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <Bot className="h-6 w-6 opacity-60" />
            <p className="text-sm">Nenhuma mensagem ainda.</p>
            <p className="text-xs max-w-xs">
              Descreva o problema com o máximo de detalhes (e-mail do painel, print do erro) para
              agilizar o atendimento.
            </p>
          </div>
        )}

        {groups.map((g, gi) => {
          const showDay = gi === 0 || groups[gi - 1]!.dayLabel !== g.dayLabel;
          return (
            <div key={g.key} className="space-y-2">
              {showDay && (
                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-border/40" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {g.dayLabel}
                  </span>
                  <span className="h-px flex-1 bg-border/40" />
                </div>
              )}

              <div
                className={`flex flex-col gap-1 ${
                  g.author === "me" ? "items-end" : g.author === "system" ? "items-center" : "items-start"
                }`}
              >
                <div className="flex items-center gap-1.5 px-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                  {g.author === "system" ? (
                    <Bot className="h-3 w-3" />
                  ) : g.author === "staff" ? (
                    <ShieldCheck className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  <span>{g.authorLabel}</span>
                </div>

                {g.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2 ${bubbleClass(g.author)} ${
                      g.author === "system" ? "text-center" : ""
                    }`}
                  >
                    {m.body && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                    )}
                    {m.attachment_url && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-border/20">
                        {m.attachment_type?.startsWith("image/") ? (
                          <img
                            src={m.attachment_url}
                            alt="anexo enviado no atendimento"
                            loading="lazy"
                            className="max-h-60 w-full object-contain bg-black/20"
                          />
                        ) : (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-2 bg-muted/30 hover:bg-muted/50 text-xs"
                          >
                            <Paperclip className="h-3 w-3" /> Baixar anexo
                          </a>
                        )}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] font-mono opacity-60 text-right">
                      {hhmm(m.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {pending.map((p) => (
          <div key={p.clientId} className="flex flex-col items-end gap-1">
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2 ${
                p.status === "failed"
                  ? "bg-destructive/10 border border-destructive/50"
                  : "bg-primary/60 text-primary-foreground"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{p.body}</p>
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] font-mono uppercase opacity-80">
                {p.status === "failed" ? (
                  <>
                    <AlertCircle className="h-3 w-3" /> Não enviada
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3 animate-pulse" /> Enviando
                  </>
                )}
              </div>
            </div>
            {p.status === "failed" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-destructive max-w-[240px] truncate">{p.error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={() => handleSend(p.attachmentPath, p.attachmentType, p.clientId)}
                >
                  <RotateCw className="h-3 w-3" /> Reenviar
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(!atBottom || unseen > 0) && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute bottom-24 right-4 h-8 gap-1 rounded-full shadow-lg text-[11px]"
          onClick={() => scrollToBottom()}
        >
          <ChevronDown className="h-3 w-3" />
          {unseen > 0 ? `${unseen} nova(s)` : "Ir para o fim"}
        </Button>
      )}

      <form
        className="p-3 sm:p-4 border-t border-border/40 bg-background/20"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileRef}
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = "";
              if (file.size > 20 * 1024 * 1024) {
                toast.error("Arquivo muito grande. O limite é 20 MB.");
                return;
              }
              setUploading(true);
              try {
                const path = `${userId}/${threadId}/${Date.now()}-${file.name}`;
                const { error } = await supabase.storage.from("support-media").upload(path, file);
                if (error) throw error;
                await handleSend(path, file.type);
              } catch (err: any) {
                toast.error(err?.message || "Falha ao anexar o arquivo.");
              } finally {
                setUploading(false);
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={uploading}
            aria-label="Anexar arquivo"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Escreva sua mensagem…  (Enter envia, Shift+Enter quebra linha)"
            className="flex-1 min-h-[42px] max-h-32 resize-none bg-background/40"
          />
          <Button type="submit" size="icon" aria-label="Enviar mensagem" disabled={!body.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
