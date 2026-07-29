import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, Check, CheckCheck, Clock, Loader2, Paperclip, RotateCw, Send } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ONBOARDING_STEP, markOnboardingStep } from "@/components/OnboardingChecklist";
import { getOrCreateThread, listMessages, sendMessage, markThreadReadByCustomer, setThreadCategory } from "@/lib/support.functions";
import { SUPPORT_CATEGORY_META, categoryMeta, type SupportCategory } from "@/lib/support-categories";
import { playNotifyDing, requestNotifyPermission, showDesktopNotification, unlockNotifySound } from "@/lib/notify-sound";

export const Route = createFileRoute("/_authenticated/suporte")({
  head: () => ({ meta: [{ title: "Suporte — Shadow" }] }),
  component: SupportPage,
});

type Thread = { id: string; category?: string | null; status?: string | null; assigned_name?: string | null };
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
  const [thread, setThread] = useState<Thread | null>(null);
  const [savingCat, setSavingCat] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pending, setPending] = useState<PendingMsg[]>([]);
  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uid, setUid] = useState<string>("");
  const [lastSeenAdminAt, setLastSeenAdminAt] = useState<number>(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef<number>(Date.now());
  const isAdminRef = useRef(false);

  const openFn = useServerFn(getOrCreateThread);
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const markReadFn = useServerFn(markThreadReadByCustomer);
  const setCatFn = useServerFn(setThreadCategory);

  // Bootstrap: usuário + thread aberta (sem assinar realtime aqui).
  useEffect(() => {
    let cancelled = false;
    requestNotifyPermission();
    markOnboardingStep(ONBOARDING_STEP.SUPPORT);
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id;
      if (cancelled || !id) return;
      setUid(id);
      const { data: adminFlag } = await supabase.rpc("has_role", { _user_id: id, _role: "admin" });
      if (!cancelled) isAdminRef.current = !!adminFlag;
    });
    openFn()
      .then((t) => { if (!cancelled) setThread(t); })
      .catch((e: any) => toast.error(e?.message ?? "Não foi possível abrir o atendimento"));
    return () => { cancelled = true; };
  }, [openFn]);

  // Mensagens + realtime da thread ativa (re-assina quando a thread muda).
  const threadId = thread?.id;
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    setMsgs([]);
    setHasMore(false);
    listFn({ data: { threadId, limit: PAGE_SIZE } })
      .then((r: any) => {
        if (cancelled) return;
        setMsgs((r?.messages ?? []) as Msg[]);
        setHasMore(!!r?.hasMore);
      })
      .catch(() => {});
    markReadFn({ data: { threadId } }).catch(() => {});

    const ch = supabase.channel(`t-${threadId}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
      (payload) => setMsgs((prev) => {
        const next = payload.new as Msg;
        if (prev.some((x) => x.id === next.id)) return prev;
        if (next.is_admin && !next.is_system) {
          // Alertas de chat (som/desktop) são restritos a admins.
          if (isAdminRef.current) {
            playNotifyDing();
            if (document.hidden) showDesktopNotification("Suporte Shadow", next.body ?? "Nova mensagem do suporte");
          }
          markReadFn({ data: { threadId } }).catch(() => {});
        }
        return [...prev, next];
      })
    ).subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [threadId, listFn, markReadFn]);

  // Carrega mensagens antigas mantendo a posição visual do scroll.
  async function loadOlder() {
    if (!threadId || loadingOlder || !hasMore || msgs.length === 0) return;
    setLoadingOlder(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const r: any = await listFn({ data: { threadId, limit: PAGE_SIZE, before: msgs[0].created_at } });
      const older = (r?.messages ?? []) as Msg[];
      setHasMore(!!r?.hasMore);
      if (older.length) {
        setMsgs((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...older.filter((m) => !seen.has(m.id)), ...prev];
        });
        requestAnimationFrame(() => {
          const node = listRef.current;
          if (node) node.scrollTop = node.scrollHeight - prevHeight;
        });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível carregar o histórico");
    }
    setLoadingOlder(false);
  }

  // Auto-carrega ao chegar no topo da lista.
  function onListScroll() {
    const el = listRef.current;
    if (el && el.scrollTop < 40) void loadOlder();
  }



  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs.length, pending.length]);

  // Mark admin messages as seen when tab is focused
  useEffect(() => {
    const onFocus = () => setLastSeenAdminAt(Date.now());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function chooseCategory(cat: SupportCategory) {
    if (!thread || savingCat) return;
    setSavingCat(true);
    try {
      const updated: any = await setCatFn({ data: { threadId: thread.id, category: cat } });
      setThread((prev) => (prev ? { ...prev, ...updated } : updated));
      toast.success(`Assunto definido: ${categoryMeta(cat).label}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível definir o assunto");
    }
    setSavingCat(false);
  }

  async function trySend(clientId: string, payload: { body?: string; attachmentPath?: string; attachmentType?: string }) {
    if (!thread) return;
    setPending((prev) => prev.map((p) => p.clientId === clientId ? { ...p, status: "sending", error: undefined } : p));
    try {
      const res: any = await sendFn({ data: { threadId: thread.id, ...payload } });
      if (res?.thread_id && res.thread_id !== thread.id) {
        // Servidor abriu um ticket novo (o anterior estava encerrado).
        // Trocar a thread já dispara o carregamento das mensagens + realtime.
        setThread((prev) => (prev ? { ...prev, id: res.thread_id, status: "open" } : prev));
      } else if (res?.id) {
        // Não depende só do realtime: mostra a mensagem imediatamente.
        setMsgs((prev) => (prev.some((x) => x.id === res.id) ? prev : [...prev, res as Msg]));
      }
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

  const active = categoryMeta(thread?.category);
  const chosen = !!thread?.category && thread.category !== "outro";
  const empty = msgs.length === 0 && pending.length === 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-neon">// support channel</div>
        <h1 className="mt-1 text-2xl font-bold">Suporte Shadow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o assunto, descreva o problema e anexe prints se precisar. Respondemos em minutos.
        </p>

        {/* Status do atendimento */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
          <span className="flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-neon">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon" /> online agora
          </span>
          <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-muted-foreground">
            ticket {thread ? `#${thread.id.slice(0, 8)}` : "abrindo..."}
          </span>
          <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-muted-foreground">
            {active.emoji} {active.label}
          </span>
          {thread?.assigned_name && (
            <span className="rounded-full border border-violet/40 bg-violet/10 px-3 py-1 text-violet-foreground">
              atendente: {thread.assigned_name}
            </span>
          )}
        </div>

        {/* Categorias */}
        <section className="mt-5">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            {chosen ? "Assunto do atendimento (pode trocar):" : "Qual é o assunto?"}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUPPORT_CATEGORY_META.map((c) => {
              const on = thread?.category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!thread || savingCat}
                  onClick={() => chooseCategory(c.id)}
                  className={`rounded-lg border p-3 text-left transition disabled:opacity-50 ${
                    on ? "border-neon/60 bg-neon/10 shadow-lg" : "border-border/60 bg-card/50 hover:border-neon/40 hover:bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span aria-hidden>{c.emoji}</span>
                    <span className="truncate">{c.label}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</div>
                  {c.urgent && <div className="mt-1 inline-block rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] font-mono uppercase text-destructive">prioridade alta</div>}
                </button>
              );
            })}
          </div>
        </section>

        {/* Mensagens rápidas */}
        {empty && (
          <div className="mt-4 flex flex-wrap gap-2">
            {active.quickMessages.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setBody(q)}
                className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-neon/40 hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 terminal-card scanlines relative flex h-[58vh] flex-col overflow-hidden">

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
            {msgs.length === 0 && pending.length === 0 && <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
                <div className="text-3xl" aria-hidden>{active.emoji}</div>
                <div className="text-sm font-medium">{active.label}</div>
                <div className="text-xs text-muted-foreground">Descreva o que aconteceu ou toque em uma mensagem rápida acima.</div>
              </div>}
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
          <form className="flex items-center gap-2 border-t border-border/40 p-3" onSubmit={(e) => { e.preventDefault(); unlockNotifySound(); send(); }}>
            <input ref={fileRef} type="file" hidden onChange={pickFile} accept="image/*,video/*,.pdf,.txt,.log,.zip" />
            <Button type="button" size="icon" variant="outline" onClick={() => { unlockNotifySound(); fileRef.current?.click(); }} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Digite sua mensagem..." />
            <Button type="submit" size="icon" disabled={sending || uploading || !body.trim()}>
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
