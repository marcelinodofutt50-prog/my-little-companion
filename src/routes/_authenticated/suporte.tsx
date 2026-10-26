import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { History, Loader2, RotateCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyRole, isStaffRole } from "@/lib/roles";
import { ONBOARDING_STEP, markOnboardingStep } from "@/components/OnboardingChecklist";
import { getOrCreateThread, markThreadReadByCustomer, setThreadCategory } from "@/lib/support.functions";
import { SupportChat } from "@/components/support/SupportChat";
import { SUPPORT_CATEGORY_META, categoryMeta, type SupportCategory } from "@/lib/support-categories";
import { requestNotifyPermission } from "@/lib/notify-sound";
import { SystemHealthIndicator } from "@/components/SystemHealthIndicator";
import { BackToDashboard } from "@/components/BackToDashboard";
import { ResponseTimeBadge } from "@/components/support/ResponseTimeBadge";


export const Route = createFileRoute("/_authenticated/suporte")({
  head: () => ({ meta: [{ title: "Suporte — Shadow" }, { name: "description", content: "Acompanhe seus chamados e a entrega da sua VPS com a equipe Shadow." }, { property: "og:title", content: "Suporte — Shadow" }, { property: "og:description", content: "Atendimento e acompanhamento de chamados Shadow." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  validateSearch: (s: Record<string, unknown>): { reabrir?: boolean; erro?: boolean; lic?: string; thread?: string } => ({
    thread: typeof s.thread === "string" && /^[0-9a-f-]{36}$/i.test(s.thread) ? s.thread : undefined,
    reabrir: s.reabrir === "1" || s.reabrir === 1 || s.reabrir === true ? true : false,
    erro: s.erro === "1" || s.erro === 1 || s.erro === true ? true : false,
    lic: typeof s.lic === "string" && s.lic ? s.lic.slice(0, 60) : "",
  }),
  component: SupportPage,
});


type Thread = { id: string; category?: string | null; status?: string | null; assigned_name?: string | null };

function SupportPage() {
  const { t } = useI18n();
  const { reabrir, erro, lic, thread: requestedThread } = Route.useSearch();
  const search = useSearch({ from: "/_authenticated/suporte" }) as any;

  useThemeSearchParam(search?.theme);
  const [thread, setThread] = useState<Thread | null>(null);
  const [opening, setOpening] = useState(true);
  const [openError, setOpenError] = useState<string | null>(null);

  const [savingCat, setSavingCat] = useState(false);
  const [uid, setUid] = useState<string>("");
  // Rascunho inserido no compositor do chat (mensagens rápidas, pré-preenchimento de erro).
  const [draft, setDraft] = useState<{ text: string; nonce: number } | null>(null);
  const isAdminRef = useRef(false);

  const openFn = useServerFn(getOrCreateThread);
  const markReadFn = useServerFn(markThreadReadByCustomer);
  const setCatFn = useServerFn(setThreadCategory);

  // Bootstrap: usuário + thread aberta. Mensagens e realtime ficam a cargo do
  // SupportChat — a página não mantém um segundo fluxo (antes carregava e
  // assinava tudo duas vezes, com aviso sonoro em dobro).
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
          if (requestedThread) {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) throw new Error("Entre na sua conta para abrir este chamado.");
            const { data: owned, error } = await supabase.from("support_threads").select("id,category,status,assigned_name").eq("id", requestedThread).eq("user_id", auth.user.id).maybeSingle();
            if (error || !owned) throw new Error("Chamado indisponível para esta conta.");
            return owned;
          }
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
  }, [openFn, requestedThread]);

  // Reabertura vinda da notificação de encerramento por inatividade.
  const reopenNotifiedRef = useRef(false);
  useEffect(() => {
    if (!reabrir || !thread?.id || reopenNotifiedRef.current) return;
    reopenNotifiedRef.current = true;
    toast.success("Atendimento reaberto", {
      description: "Envie sua mensagem que a equipe retoma daqui. Seu histórico anterior continua salvo.",
    });
  }, [reabrir, thread?.id]);

  // Chegou pelo botão "Tem algum erro?" do painel: já deixa a mensagem pronta
  // no compositor do chat.
  const errorPrefillRef = useRef(false);
  useEffect(() => {
    if (!erro || !thread?.id || errorPrefillRef.current) return;
    errorPrefillRef.current = true;
    setDraft({
      text:
        `Estou com erro no meu login${lic ? ` (usuário: ${lic})` : ""}. ` +
        "Código do erro (se aparecer): ___. Já tentei fechar e abrir o painel.",
      nonce: Date.now(),
    });
    setCatFn({ data: { threadId: thread.id, category: "login" as SupportCategory } }).catch(() => {});
    toast.info("Descreva o erro que a equipe corrige seu login", {
      description: "Se aparecer um código (ex.: 803), coloque na mensagem.",
    });
  }, [erro, lic, thread?.id, setCatFn]);

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

  const active = categoryMeta(thread?.category);
  const chosen = !!thread?.category && thread.category !== "outro";

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
          <ResponseTimeBadge />
        </div>

        <section className="mt-5 overflow-hidden rounded-lg border border-cyan/30 bg-cyan/5 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan/30 bg-cyan/10 text-cyan">
                <History className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Já tem uma licença antiga e quer renovar ou vincular?</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Informe o e-mail do login, a senha da licença, a versão e o IP. O sistema verifica o painel antes de liberar o pagamento; se não conseguir confirmar, a equipe recebe o diagnóstico.</p>
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0 font-mono text-[10px] uppercase tracking-wider">
              <Link to="/renovar-servidor">Verificar licença</Link>
            </Button>
          </div>
          <p className="mt-3 border-t border-cyan/20 pt-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Nunca pedimos a senha do seu Gmail. Use somente a senha do login BTmob.</p>
        </section>

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

        {/* Mensagens rápidas: inserem rascunho no compositor do chat */}
        <div className="mt-4 flex flex-wrap gap-2">
          {active.quickMessages.map((q) => (
            <button
              key={q}
              type="button"
              disabled={!thread}
              onClick={() => setDraft({ text: q, nonce: Date.now() })}
              className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-neon/40 hover:text-foreground disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="mt-5 terminal-card scanlines relative h-[76vh] min-h-[560px] max-h-[calc(100dvh-150px)] sm:h-[82vh] sm:max-h-[calc(100dvh-140px)] md:h-[86vh] lg:h-[88vh] overflow-hidden flex flex-col">
          {thread?.id && uid ? (
            <SupportChat
              threadId={thread.id}
              userId={uid}
              insertDraft={draft}
              onNewMessage={() => markReadFn({ data: { threadId: thread.id } })}
              onThreadMigrated={(id) => setThread((prev) => (prev && prev.id === id ? prev : { ...(prev ?? {}), id }))}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abrindo seu atendimento…
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
