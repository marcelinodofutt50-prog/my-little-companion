import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, Check, CheckCheck, Clock, Loader2, Paperclip, RotateCw, Send } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateThread, listMessages, sendMessage } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/suporte")({
  head: () => ({ meta: [{ title: "Suporte — Shadow" }] }),
  component: SupportPage,
});

type Msg = { id: string; body: string | null; attachment_url: string | null; attachment_type: string | null; is_admin: boolean; is_system?: boolean; created_at: string; sender_id: string };
type PendingMsg = {
  clientId: string;
  body: string | null;
  attachmentPath?: string;
  attachmentType?: string;
  status: "sending" | "failed";
  error?: string;
  created_at: string;
};

function SupportPage() {
  const [thread, setThread] = useState<{ id: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pending, setPending] = useState<PendingMsg[]>([]);
  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uid, setUid] = useState<string>("");
  const [lastSeenAdminAt, setLastSeenAdminAt] = useState<number>(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef<number>(Date.now());

  const openFn = useServerFn(getOrCreateThread);
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? ""));
    openFn().then(async (t) => {
      setThread(t);
      const m = await listFn({ data: { threadId: t.id } });
      setMsgs(m as Msg[]);
      const ch = supabase.channel(`t-${t.id}`).on("postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${t.id}` },
        (payload) => setMsgs((prev) => {
          const next = payload.new as Msg;
          if (prev.some((x) => x.id === next.id)) return prev;
          return [...prev, next];
        })
      ).subscribe();
      return () => { supabase.removeChannel(ch); };
    });
  }, [openFn, listFn]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs.length, pending.length]);

  // Mark admin messages as seen when tab is focused
  useEffect(() => {
    const onFocus = () => setLastSeenAdminAt(Date.now());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function trySend(clientId: string, payload: { body?: string; attachmentPath?: string; attachmentType?: string }) {
    if (!thread) return;
    setPending((prev) => prev.map((p) => p.clientId === clientId ? { ...p, status: "sending", error: undefined } : p));
    try {
      await sendFn({ data: { threadId: thread.id, ...payload } });
      // Success — realtime INSERT will bring the confirmed message; drop the pending entry.
      setPending((prev) => prev.filter((p) => p.clientId !== clientId));
    } catch (e: any) {
      const message = e?.message ?? "Falha ao enviar";
      setPending((prev) => prev.map((p) => p.clientId === clientId ? { ...p, status: "failed", error: message } : p));
      toast.error(message);
    }
  }

  async function send(attachmentPath?: string, attachmentType?: string) {
    if (!thread) return;
    const text = body.trim();
    if (!text && !attachmentPath) return;
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: PendingMsg = {
      clientId,
      body: text || null,
      attachmentPath,
      attachmentType,
      status: "sending",
      created_at: new Date().toISOString(),
    };
    setPending((prev) => [...prev, entry]);
    setBody("");
    await trySend(clientId, { body: text || undefined, attachmentPath, attachmentType });
  }

  async function retry(clientId: string) {
    const entry = pending.find((p) => p.clientId === clientId);
    if (!entry) return;
    await trySend(clientId, {
      body: entry.body ?? undefined,
      attachmentPath: entry.attachmentPath,
      attachmentType: entry.attachmentType,
    });
  }

  function discard(clientId: string) {
    setPending((prev) => prev.filter((p) => p.clientId !== clientId));
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !thread || !uid) return;
    if (file.size > 20 * 1024 * 1024) return toast.error("Máx 20MB");
    setUploading(true);
    try {
      const path = `${uid}/${thread.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("support-media").upload(path, file, { contentType: file.type });
      if (error) throw error;
      await send(path, file.type);
    } catch (e: any) { toast.error(e.message); }
    setUploading(false);
  }

  const hasNewAdmin = useMemo(
    () => msgs.some((m) => m.is_admin && m.sender_id !== uid && new Date(m.created_at).getTime() > Math.max(lastSeenAdminAt, mountedAtRef.current)),
    [msgs, uid, lastSeenAdminAt]
  );

  const sending = pending.some((p) => p.status === "sending");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-neon">// support channel</div>
        <h1 className="mt-1 text-2xl font-bold">Chat com Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Anexe prints, vídeos ou arquivos. Nosso time responde em minutos.</p>

        <div className="mt-6 terminal-card scanlines relative flex h-[65vh] flex-col overflow-hidden">
          {hasNewAdmin && (
            <button
              type="button"
              onClick={() => { setLastSeenAdminAt(Date.now()); listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }}
              className="absolute right-3 top-3 z-10 rounded-full border border-violet/60 bg-violet/20 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-violet-foreground hover:bg-violet/30"
            >
              nova resposta do admin
            </button>
          )}
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && pending.length === 0 && <div className="pt-16 text-center text-sm text-muted-foreground">Nenhuma mensagem. Envie a primeira.</div>}
            {msgs.map((m) => {
              if (m.is_system) {
                return (
                  <div key={m.id} className="flex justify-center">
                    <div className="max-w-[85%] rounded-lg border border-cyan/30 bg-cyan/5 px-4 py-2 font-mono text-xs text-cyan whitespace-pre-wrap text-center">
                      {m.body}
                    </div>
                  </div>
                );
              }
              const mine = m.sender_id === uid && !m.is_admin;
              const fromAdmin = m.is_admin && m.sender_id !== uid;
              const label = mine ? "você" : fromAdmin ? "admin" : "suporte";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "border border-neon/40 bg-neon/10" : "border border-violet/40 bg-violet/10"}`}>
                    <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase text-muted-foreground">
                      <span>{label} · {new Date(m.created_at).toLocaleTimeString("pt-BR")}</span>
                      {mine && <CheckCheck className="h-3 w-3 text-neon" aria-label="Enviada" />}
                    </div>
                    {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                    {m.attachment_url && (
                      m.attachment_type?.startsWith("image/") ? <img src={m.attachment_url} alt="anexo" className="mt-2 max-h-64 rounded" />
                      : m.attachment_type?.startsWith("video/") ? <video src={m.attachment_url} controls className="mt-2 max-h-64 rounded" />
                      : <a href={m.attachment_url} target="_blank" rel="noreferrer" className="mt-2 block text-cyan underline">Baixar anexo</a>
                    )}
                  </div>
                </div>
              );
            })}
            {pending.map((p) => {
              const failed = p.status === "failed";
              return (
                <div key={p.clientId} className="flex justify-end">
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm border ${failed ? "border-destructive/50 bg-destructive/10" : "border-neon/30 bg-neon/5 opacity-80"}`}>
                    <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase text-muted-foreground">
                      <span>você · {new Date(p.created_at).toLocaleTimeString("pt-BR")}</span>
                      {failed ? (
                        <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" /> falhou</span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3 animate-pulse" /> enviando</span>
                      )}
                    </div>
                    {p.body && <div className="whitespace-pre-wrap break-words">{p.body}</div>}
                    {p.attachmentPath && (
                      <div className="mt-1 text-[10px] text-muted-foreground italic">
                        {p.attachmentType?.startsWith("image/") ? "imagem" : p.attachmentType?.startsWith("video/") ? "vídeo" : "arquivo"} anexado
                      </div>
                    )}
                    {failed && (
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-destructive/30 pt-2">
                        <span className="text-[10px] text-destructive/90 truncate">{p.error ?? "Erro desconhecido"}</span>
                        <div className="flex gap-1 shrink-0">
                          <Button type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-[10px]" onClick={() => retry(p.clientId)}>
                            <RotateCw className="h-3 w-3" /> tentar novamente
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => discard(p.clientId)}>
                            descartar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <form className="flex items-center gap-2 border-t border-border/40 p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input ref={fileRef} type="file" hidden onChange={pickFile} accept="image/*,video/*,.pdf,.txt,.log,.zip" />
            <Button type="button" size="icon" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Digite sua mensagem..." />
            <Button type="submit" size="icon" disabled={sending && !body.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="border-t border-border/40 bg-card/50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> enviando</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> enviada</span>
            <span className="flex items-center gap-1 text-neon"><CheckCheck className="h-3 w-3" /> confirmada</span>
            <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" /> falhou</span>
          </div>
        </div>
      </main>
    </div>
  );
}
