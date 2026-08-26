import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SupportSummaryPanel } from "./SupportSummaryPanel";

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
  Reply,
  X,
  ZoomIn,
  Wand2,
  Undo2,
  FileText,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { playNotifyDing } from "@/lib/notify-sound";
import {
  SUPPORT_MEDIA_BUCKET,
  SUPPORT_MEDIA_MAX_BYTES,
  formatBytes,
  mediaFileName,
  mediaKind,
  safeMediaFileName,
} from "@/lib/support-media";
import { refineSupportReply } from "@/lib/support-refine.functions";

type RefineTone = "formal" | "empatico" | "direto";

const REFINE_TONES: Array<{ tone: RefineTone; label: string }> = [
  { tone: "formal", label: "Formalizar" },
  { tone: "empatico", label: "Empático" },
  { tone: "direto", label: "Direto" },
];

type PendingMsg = {
  clientId: string;
  body: string | null;
  attachmentPath?: string;
  attachmentType?: string;
  attachmentName?: string;
  previewUrl?: string;
  status: "sending" | "failed";
  error?: string;
  created_at: string;
};

interface SupportChatProps {
  threadId: string;
  userId: string;
  isAdmin?: boolean;
  /** Nome exibido para as mensagens do cliente quando um admin está lendo. */
  customerName?: string;
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

/**
 * Agrupa por dia e por autor em sequência.
 *
 * O rótulo depende de QUEM está vendo o chat:
 *  - suas próprias mensagens -> "Você"
 *  - mensagens da equipe      -> "Suporte Shadow"
 *  - mensagens do cliente vistas por um admin -> "Cliente"
 */
function groupMessages(
  msgs: SupportMessage[],
  userId: string,
  viewerIsAdmin: boolean,
  customerLabel = "Cliente",
): Group[] {
  const groups: Group[] = [];
  for (const m of msgs) {
    const mine = !!m.sender_id && m.sender_id === userId;
    const author: Group["author"] = m.is_system ? "system" : mine ? "me" : "staff";
    const label = m.is_system
      ? "Assistente Shadow"
      : mine
        ? "Você"
        : m.is_admin
          ? "Suporte Shadow"
          : viewerIsAdmin
            ? customerLabel
            : "Suporte Shadow";
    const day = dayLabel(m.created_at);
    const last = groups[groups.length - 1];
    const withinWindow =
      last &&
      last.author === author &&
      last.authorLabel === label &&
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


/** Bolha de anexo: imagem, vídeo, áudio, PDF ou arquivo genérico. */
function Attachment({
  url,
  type,
  onZoom,
}: {
  url: string;
  type: string | null;
  onZoom: (url: string) => void;
}) {
  const [broken, setBroken] = useState(false);
  const kind = mediaKind(type, url);
  const name = mediaFileName(url);

  if (broken || kind === "file" || kind === "pdf") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 flex items-center gap-2 rounded-lg border border-border/30 bg-muted/30 p-2 text-xs hover:bg-muted/50"
      >
        {kind === "pdf" ? <FileText className="h-4 w-4 shrink-0" /> : <Paperclip className="h-4 w-4 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <div className="mt-2 overflow-hidden rounded-lg border border-border/20 bg-black/30">
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          className="max-h-72 w-full"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="mt-2 rounded-lg border border-border/20 bg-muted/30 p-2">
        <audio src={url} controls preload="metadata" className="w-full" onError={() => setBroken(true)} />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group/img relative mt-2 block overflow-hidden rounded-lg border border-border/20"
      onClick={() => onZoom(url)}
      aria-label="Ampliar imagem do anexo"
    >
      <img
        src={url}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="max-h-60 w-full cursor-zoom-in bg-black/20 object-contain"
      />
      <span className="absolute bottom-1 right-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover/img:opacity-100">
        <ZoomIn className="h-3 w-3" />
      </span>
    </button>
  );
}


export function SupportChat({ threadId, userId, isAdmin = false, customerName, onNewMessage }: SupportChatProps) {
  const [msgs, setMsgs] = useState<SupportMessage[]>([]);
  const [pending, setPending] = useState<PendingMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [replyTo, setReplyTo] = useState<SupportMessage | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [refining, setRefining] = useState<null | RefineTone>(null);
  const [preRefine, setPreRefine] = useState<string | null>(null);

  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const markReadFn = useServerFn(markThreadReadByCustomer);
  const refineFn = useServerFn(refineSupportReply);

  const handleRefine = async (tone: RefineTone) => {
    const draft = body.trim();
    if (!draft || refining) return;
    setRefining(tone);
    try {
      const res: any = await refineFn({ data: { threadId, draft, tone } });
      if (res?.text) {
        setPreRefine(draft);
        setBody(res.text);
        toast.success("Texto reformulado — revise antes de enviar.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível reformular o texto agora.");
    } finally {
      setRefining(null);
    }
  };

  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Refs evitam closure velha dentro da assinatura do tempo real.
  const atBottomRef = useRef(true);
  const msgIdsRef = useRef<Set<string>>(new Set());
  const [dragActive, setDragActive] = useState(false);
  const [connection, setConnection] = useState<"live" | "reconnecting">("live");

  useEffect(() => {
    atBottomRef.current = atBottom;
  }, [atBottom]);

  useEffect(() => {
    msgIdsRef.current = new Set(msgs.map((m) => m.id));
  }, [msgs]);

  const groups = useMemo(
    () => groupMessages(msgs, userId, isAdmin, customerName || "Cliente"),
    [msgs, userId, isAdmin, customerName],
  );

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior });
    setUnseen(0);
  };

  const loadMessages = async (before?: string) => {
    try {
      const r: any = await listFn({ data: { threadId, limit: 30, before } });
      const newMsgs = normalizeSupportMessages(r.messages, threadId);
      if (before) {
        setMsgs((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...newMsgs.filter((m) => !seen.has(m.id)), ...prev];
        });
      } else {
        // Mantém mensagens que chegaram pelo tempo real e ainda não estão na página.
        setMsgs((prev) => {
          const ids = new Set(newMsgs.map((m) => m.id));
          const extra = prev.filter((m) => !ids.has(m.id) && newMsgs.length > 0 &&
            m.created_at > (newMsgs[newMsgs.length - 1]?.created_at ?? ""));
          return [...newMsgs, ...extra];
        });
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

    let subscribedOnce = false;
    const ch = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const next = normalizeSupportMessage(payload.new, threadId);
          if (!next.id || msgIdsRef.current.has(next.id)) return;
          msgIdsRef.current.add(next.id);
          if (next.sender_id !== userId) {
            playNotifyDing();
            onNewMessage?.();
            if (!atBottomRef.current) setUnseen((u) => u + 1);
          }
          setMsgs((prev) =>
            prev.some((m) => m.id === next.id)
              ? prev
              : [...prev, next].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
          );
        },
      )
      .subscribe((status) => {
        setConnection(status === "SUBSCRIBED" ? "live" : "reconnecting");
        if (status !== "SUBSCRIBED") return;
        // Só recarrega em RE-conexão (a carga inicial já aconteceu acima).
        if (subscribedOnce) void loadMessages();
        subscribedOnce = true;
      });

    // Rede/aba voltando: reconciliar a conversa.
    const resync = () => {
      if (document.visibilityState === "visible") void loadMessages();
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("online", resync);

    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("online", resync);
      supabase.removeChannel(ch);
    };
  }, [threadId, userId]);

  // Fecha o visualizador de imagem com Esc.
  useEffect(() => {
    if (!zoomUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomUrl(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [zoomUrl]);

  useEffect(() => {
    if (!loadingOlder && atBottom) scrollToBottom();
  }, [msgs.length, pending.length]);

  const handleSend = async (
    attachmentPath?: string,
    attachmentType?: string,
    retryOf?: string,
    meta?: { name?: string; previewUrl?: string },
  ) => {
    const previous = retryOf ? pending.find((p) => p.clientId === retryOf) : undefined;
    const text = retryOf ? (previous?.body ?? "") : body.trim();
    if (!text && !attachmentPath) return;
    const replyToId = retryOf ? null : replyTo?.id ?? null;

    const clientId = retryOf ?? `local-${Date.now()}`;
    const newPending: PendingMsg = {
      clientId,
      body: text || null,
      ...(attachmentPath ? { attachmentPath } : {}),
      ...(attachmentType ? { attachmentType } : {}),
      ...(meta?.name ?? previous?.attachmentName ? { attachmentName: meta?.name ?? previous?.attachmentName } : {}),
      ...(meta?.previewUrl ?? previous?.previewUrl ? { previewUrl: meta?.previewUrl ?? previous?.previewUrl } : {}),
      status: "sending",
      created_at: new Date().toISOString(),
    };

    setPending((prev) =>
      retryOf ? prev.map((p) => (p.clientId === retryOf ? newPending : p)) : [...prev, newPending],
    );
    if (!retryOf) {
      setBody("");
      setReplyTo(null);
    }

    try {
      const res: any = await sendFn({
        data: {
          threadId,
          body: text || undefined,
          attachmentPath,
          attachmentType,
          replyToId: replyToId ?? undefined,
        },
      });
      setMsgs((prev) => {
        const normalized = normalizeSupportMessage(res, threadId);
        if (prev.some((m) => m.id === normalized.id)) return prev;
        return [...prev, normalized];
      });
      setPending((prev) => {
        const done = prev.find((p) => p.clientId === clientId);
        if (done?.previewUrl) URL.revokeObjectURL(done.previewUrl);
        return prev.filter((p) => p.clientId !== clientId);
      });
      setAtBottom(true);
    } catch (e: any) {
      const message = e?.message || "Falha ao enviar a mensagem.";
      setPending((prev) =>
        prev.map((p) => (p.clientId === clientId ? { ...p, status: "failed", error: message } : p)),
      );
      toast.error(message);
    }
  };

  /** Sobe o arquivo para o storage e envia como anexo. */
  const uploadAndSend = async (file: File) => {
    if (uploading) return;
    if (file.size > SUPPORT_MEDIA_MAX_BYTES) {
      toast.error(`Arquivo muito grande (${formatBytes(file.size)}). O limite é ${formatBytes(SUPPORT_MEDIA_MAX_BYTES)}.`);
      return;
    }
    if (file.size === 0) {
      toast.error("Esse arquivo está vazio.");
      return;
    }
    const isImage = (file.type || "").startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
    setUploading(true);
    const toastId = toast.loading(`Enviando ${file.name}…`);
    try {
      const safeName = safeMediaFileName(file.name || "arquivo");
      const path = `${userId}/${threadId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from(SUPPORT_MEDIA_BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      toast.dismiss(toastId);
      await handleSend(path, file.type || "application/octet-stream", undefined, {
        name: file.name,
        ...(previewUrl ? { previewUrl } : {}),
      });
    } catch (err: any) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      toast.error(err?.message || "Falha ao anexar o arquivo.", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const bubbleClass = (author: Group["author"]) =>
    author === "system"
      ? "bg-cyan/10 border border-cyan/40 text-cyan"
      : author === "me"
        ? "bg-primary text-primary-foreground"
        : "bg-muted/50 border border-border/40";

  return (
    <div
      className="relative flex flex-col h-full bg-background/40 backdrop-blur-sm border border-border/40 rounded-lg overflow-hidden"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={(e) => {
        const file = Array.from(e.dataTransfer.files ?? [])[0];
        if (file) {
          e.preventDefault();
          setDragActive(false);
          void uploadAndSend(file);
        }
      }}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-primary/60 bg-background/80 text-sm font-mono uppercase tracking-widest text-primary">
          Solte o arquivo para anexar
        </div>
      )}
      {connection === "reconnecting" && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/10 py-1 text-[10px] font-mono uppercase tracking-widest text-amber-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Reconectando ao chat
        </div>
      )}
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

                {g.messages.map((m) => {
                  const quoted = m.reply_to_id ? msgs.find((q) => q.id === m.reply_to_id) : null;
                  return (
                  <div
                    key={m.id}
                    className={`group/msg relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2 ${bubbleClass(g.author)} ${
                      g.author === "system" ? "text-center" : ""
                    }`}
                  >
                    {quoted && (
                      <div className="mb-2 rounded-lg border-l-2 border-current/40 bg-black/20 px-2 py-1 text-[11px] opacity-80">
                        <span className="block font-mono text-[9px] uppercase tracking-wide opacity-70">
                          Respondendo
                        </span>
                        <span className="line-clamp-2 break-words">
                          {quoted.body || "Anexo"}
                        </span>
                      </div>
                    )}
                    {g.author !== "system" && (
                      <button
                        type="button"
                        aria-label="Responder mensagem"
                        onClick={() => setReplyTo(m)}
                        className="absolute -top-2 right-2 hidden rounded-full border border-border/40 bg-background p-1 text-muted-foreground shadow group-hover/msg:block hover:text-foreground"
                      >
                        <Reply className="h-3 w-3" />
                      </button>
                    )}
                    {m.body && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                    )}
                    {m.attachment_url && (
                      <Attachment url={m.attachment_url} type={m.attachment_type} onZoom={setZoomUrl} />
                    )}
                    <div className="mt-1 text-[10px] font-mono opacity-60 text-right">
                      {hhmm(m.created_at)}
                    </div>
                  </div>
                  );
                })}
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
              {p.body && <p className="text-sm whitespace-pre-wrap break-words">{p.body}</p>}
              {p.previewUrl && (
                <img
                  src={p.previewUrl}
                  alt="pré-visualização do anexo"
                  className="mt-2 max-h-48 rounded-lg object-contain opacity-80"
                />
              )}
              {!p.previewUrl && p.attachmentName && (
                <div className="mt-1 flex items-center gap-2 text-xs opacity-90">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[200px] truncate">{p.attachmentName}</span>
                </div>
              )}
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
                  onClick={() => void handleSend(p.attachmentPath, p.attachmentType, p.clientId)}
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

      {replyTo && (
        <div className="flex items-start gap-2 border-t border-border/40 bg-muted/30 px-3 py-2 sm:px-4">
          <Reply className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Respondendo
            </p>
            <p className="truncate text-xs">{replyTo.body || "Anexo"}</p>
          </div>
          <button
            type="button"
            aria-label="Cancelar resposta"
            onClick={() => setReplyTo(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form
        className="p-3 sm:p-4 border-t border-border/40 bg-background/20"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        {isAdmin && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Reformular com IA
            </span>
            {REFINE_TONES.map((t) => (
              <Button
                key={t.tone}
                type="button"
                size="sm"
                variant="outline"
                disabled={!body.trim() || refining !== null}
                onClick={() => handleRefine(t.tone)}
                className="h-6 gap-1 px-2 text-[10px]"
              >
                {refining === t.tone ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
                {t.label}
              </Button>
            ))}
            {preRefine && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={refining !== null}
                onClick={() => {
                  setBody(preRefine);
                  setPreRefine(null);
                }}
                className="h-6 gap-1 px-2 text-[10px] text-muted-foreground"
              >
                <Undo2 className="h-3 w-3" /> Desfazer
              </Button>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileRef}
            hidden
            accept="image/*,video/*,audio/*,.pdf,.txt,.log,.zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadAndSend(file);
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
            onPaste={(e) => {
              const file = Array.from(e.clipboardData?.files ?? [])[0];
              if (file) {
                e.preventDefault();
                void uploadAndSend(file);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Escreva sua mensagem…  (Enter envia, Shift+Enter quebra linha)"
            className="flex-1 min-h-[68px] max-h-56 resize-y bg-background/40 text-sm leading-relaxed"

          />
          <Button type="submit" size="icon" aria-label="Enviar mensagem" disabled={!body.trim() || uploading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {zoomUrl && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-black/95 p-4 pt-16 pb-16"
            style={{ height: "100dvh", width: "100vw" }}
            role="dialog"
            aria-modal="true"
            aria-label="Visualização ampliada do anexo"
            onClick={() => setZoomUrl(null)}
          >
            <img
              src={zoomUrl}
              alt="anexo ampliado"
              className="max-h-full max-w-full object-contain select-none"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Fechar imagem"
              className="absolute right-4 top-4 h-10 w-10 rounded-full"
              onClick={() => setZoomUrl(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <a
              href={zoomUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-4 py-1.5 text-xs"
            >
              Abrir em nova aba
            </a>
          </div>,
          document.body,
        )}
    </div>
  );
}
