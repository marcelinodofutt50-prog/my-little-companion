import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, Maximize2, MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateThread } from "@/lib/support.functions";
import { SupportChat } from "@/components/support/SupportChat";

const GREETINGS = [
  "Tá precisando de ajuda? 👋",
  "Tá com algum problema? Fala com a gente!",
  "Ficou com alguma dúvida? Estamos aqui.",
];
const DISMISS_KEY = "shadow:support-bubble-dismissed";

/** Balãozinho do suporte no canto da tela + mini chat. */
export function SupportFloatingWidget() {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openFn = useServerFn(getOrCreateThread);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { /* */ }
    if (dismissed) return;
    const t = window.setTimeout(() => setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]), 3500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open || thread) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("Entre na sua conta para falar com o suporte.");
        const t: any = await openFn();
        if (!cancelled) { setUid(data.user.id); setThread(t?.id ?? t?.thread?.id ?? null); }
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e).replace(/^Error:\s*/, ""));
      }
    })();
    return () => { cancelled = true; };
  }, [open, thread, openFn]);

  const dismiss = () => {
    setGreeting(null);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* */ }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[min(560px,calc(100dvh-110px))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-300">
          <div className="flex items-center justify-between border-b border-border/60 bg-primary px-4 py-3 text-primary-foreground">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Suporte Shadow</div>
              <div className="text-[11px] opacity-80">Conte sua dúvida ou problema</div>
            </div>
            <div className="flex items-center gap-1">
              <Link to="/suporte" search={{}} className="rounded p-1.5 hover:bg-primary-foreground/10" aria-label="Abrir em tela cheia">
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1.5 hover:bg-primary-foreground/10" aria-label="Fechar chat">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            {thread && uid ? (
              <SupportChat threadId={thread} userId={uid} onThreadMigrated={(id) => setThread(id)} />
            ) : error ? (
              <p className="p-6 text-center text-sm text-destructive">{error}</p>
            ) : (
              <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            )}
          </div>
        </div>
      )}

      {!open && greeting && (
        <div className="relative max-w-[260px] rounded-2xl rounded-br-sm border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <button type="button" onClick={dismiss} className="absolute -left-2 -top-2 rounded-full border border-border bg-background p-0.5 text-muted-foreground hover:text-foreground" aria-label="Dispensar">
            <X className="h-3 w-3" />
          </button>
          <button type="button" className="text-left" onClick={() => { setOpen(true); setGreeting(null); }}>
            <div className="font-semibold">{greeting}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Clique aqui e fale com o suporte.</div>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setGreeting(null); }}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 active:scale-95"
        aria-label={open ? "Fechar suporte" : "Abrir suporte"}
      >
        {!open && greeting && <span className="absolute right-0 top-0 h-3 w-3 animate-ping rounded-full bg-primary" />}
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
