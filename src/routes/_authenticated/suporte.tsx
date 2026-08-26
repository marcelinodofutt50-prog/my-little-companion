import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, Check, CheckCheck, Clock, Loader2, Paperclip, RotateCw, Send, Server, Sparkles, Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyRole, isStaffRole } from "@/lib/roles";
import { ONBOARDING_STEP, markOnboardingStep } from "@/components/OnboardingChecklist";
import { getOrCreateThread, listMessages, sendMessage, markThreadReadByCustomer, setThreadCategory } from "@/lib/support.functions";
import { SupportChat } from "@/components/support/SupportChat";
import { SUPPORT_CATEGORY_META, categoryMeta, type SupportCategory } from "@/lib/support-categories";
import { playNotifyDing, requestNotifyPermission, showDesktopNotification, unlockNotifySound } from "@/lib/notify-sound";
import { SystemHealthIndicator } from "@/components/SystemHealthIndicator";
import { BackToDashboard } from "@/components/BackToDashboard";


export const Route = createFileRoute("/_authenticated/suporte")({
  head: () => ({ meta: [{ title: "Suporte — Shadow" }] }),
  validateSearch: (s: Record<string, unknown>): { reabrir?: boolean; erro?: boolean; lic?: string } => ({
    reabrir: s.reabrir === "1" || s.reabrir === 1 || s.reabrir === true ? true : false,
    erro: s.erro === "1" || s.erro === 1 || s.erro === true ? true : false,
    lic: typeof s.lic === "string" && s.lic ? s.lic.slice(0, 60) : "",
  }),
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

const PAGE_SIZE = 30;

function SupportPage() {
  const { t } = useI18n();
  const { reabrir, erro, lic } = Route.useSearch();
  const search = useSearch({ from: "/_authenticated/suporte" }) as any;

  useThemeSearchParam(search?.theme);
  const [thread, setThread] = useState<Thread | null>(null);
  const [opening, setOpening] = useState(true);
  const [openError, setOpenError] = useState<string | null>(null);

  const [savingCat, setSavingCat] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pending, setPending] = useState<PendingMsg[]>([]);

  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uid, setUid] = useState<string>("");
  const [lastSeenAdminAt, setLastSeenAdminAt] = useState<number>(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
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
      const role = await fetchMyRole(id);
      if (!cancelled) isAdminRef.current = isStaffRole(role);
    });
    setOpening(true);
    setOpenError(null);
    const openWithRetry = async () => {
      let lastError: any;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await openFn();
        } catch (error) {
          lastError = error;
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
        }
      }
      throw lastError;
    };
    openWithRetry()
      .then((t) => { if (!cancelled) setThread(t); })
      .catch((e: any) => {
        if (!cancelled) {
          const message = e?.message ?? "Não foi possível abrir o atendimento";
          toast.error(message);
          setOpenError(message);
        }
      })
      .finally(() => { if (!cancelled) setOpening(false); });
    return () => { cancelled = true; };
  }, [openFn]);

  // Reabertura vinda da notificação de encerramento por inatividade.
  const reopenNotifiedRef = useRef(false);
  useEffect(() => {
    if (!reabrir || !thread?.id || reopenNotifiedRef.current) return;
    reopenNotifiedRef.current = true;
    toast.success("Atendimento reaberto", {
      description: "Envie sua mensagem que a equipe retoma daqui. Seu histórico anterior continua salvo.",
    });
    composerRef.current?.focus();
  }, [reabrir, thread?.id]);

  // Chegou pelo botão "Tem algum erro?" do painel: já deixa a mensagem pronta.
  const errorPrefillRef = useRef(false);
  useEffect(() => {
    if (!erro || !thread?.id || errorPrefillRef.current) return;
    errorPrefillRef.current = true;
    setBody((cur) =>
      cur.trim()
        ? cur
        : `Estou com erro no meu login${lic ? ` (usuário: ${lic})` : ""}. ` +
          "Código do erro (se aparecer): ___. Já tentei fechar e abrir o painel.",
    );
    setThread((t) => t);
    setCatFn({ data: { threadId: thread.id, category: "login" as SupportCategory } }).catch(() => {});
    toast.info("Descreva o erro que a equipe corrige seu login", {
      description: "Se aparecer um código (ex.: 803), coloque na mensagem.",
    });
    composerRef.current?.focus();
  }, [erro, lic, thread?.id, setCatFn]);


  // Mensagens + realtime da thread ativa (re-assina quando a thread muda).
  const threadId = thread?.id;
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    setMsgs([]);
    setHasMore(false);
    
    const loadMessages = async () => {
      try {
        const r: any = await listFn({ data: { threadId, limit: PAGE_SIZE } });
        if (!cancelled) {
          setMsgs((r?.messages ?? []) as Msg[]);
          setHasMore(!!r?.hasMore);
        }
      } catch (error: any) {
        if (!cancelled) toast.error(error?.message ?? "Erro ao carregar mensagens");
      }
    };

    loadMessages();
    markReadFn({ data: { threadId } }).catch(() => {});

    // Canal Realtime reforçado
    const ch = supabase.channel(`t-${threadId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const next = payload.new as Msg;
          setMsgs((prev) => {
            if (prev.some((x) => x.id === next.id)) return prev;
            playNotifyDing();
            if (next.is_admin && !next.is_system && next.sender_id !== uid) {
              if (document.hidden) showDesktopNotification("Suporte Shadow", next.body ?? "Nova mensagem do suporte");
              markReadFn({ data: { threadId } }).catch(() => {});
            }
            return [...prev, next];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log(`[Suporte] Canal Realtime conectado: ${threadId}`);
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn("[Suporte] Realtime desconectado, tentando recarregar...");
          if (!cancelled) setTimeout(loadMessages, 3000);
        }
      });

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



  // Só rola para o fim quando chega mensagem nova (não ao carregar histórico).
  const lastMsgId = msgs.length ? msgs[msgs.length - 1].id : "";
  useEffect(() => {
    if (loadingOlder) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMsgId, pending.length]);


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
    <div className="client-enterprise min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4"><BackToDashboard /></div>
        <div className="osint-panel osint-corners osint-sweep relative overflow-hidden p-5" style={{ ["--osint-sweep-h" as any]: "120px" }}>
          <div className="osint-label text-neon">// support channel</div>
          <h1 className="mt-1 text-2xl font-bold">{t("chat.title" as any)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("contact.lead" as any)}
          </p>
          <div className="osint-ticker pointer-events-none mt-4 h-1 w-full rounded-full opacity-60" />
        </div>

        {/* Status do atendimento */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
          <SystemHealthIndicator />
          <span className="flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-neon">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon" /> online agora
          </span>

          <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-muted-foreground">
            ticket {thread ? `#${thread.id.slice(0, 8)}` : opening ? "abrindo..." : "indisponível"}
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

        {openError && !thread && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span>{openError}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Tentar novamente
            </Button>
          </div>
        )}

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

        <div className="mt-5 terminal-card scanlines relative h-[88vh] min-h-[640px] max-h-[calc(100dvh-140px)] overflow-hidden flex flex-col">
          {thread?.id && uid ? (
            <SupportChat 
              threadId={thread.id} 
              userId={uid} 
              onNewMessage={() => markReadFn({ data: { threadId: thread.id } })}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p className="font-mono text-xs uppercase">Inicializando canal seguro...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
