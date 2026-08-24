import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Bug, Heart, Lightbulb, Loader2, MessageSquareWarning, Send, ShieldCheck } from "lucide-react";
import { listMyFeedback, submitFeedback } from "@/lib/feedback.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sugestoes")({
  head: () => ({
    meta: [
      { title: "Sugestões e críticas — Shadow" },
      {
        name: "description",
        content: "Envie sugestões de melhoria, críticas anônimas, bugs ou elogios direto para a equipe Shadow.",
      },
      { property: "og:title", content: "Sugestões e críticas — Shadow" },
      { property: "og:description", content: "Sua opinião chega direto na equipe — pode ser anônima." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuggestionsPage,
});

const TABS = [
  { key: "melhoria", label: "Melhoria", icon: Lightbulb, hint: "O que faria o Shadow ficar melhor pra você?" },
  { key: "critica", label: "Crítica", icon: MessageSquareWarning, hint: "Pode ser dura — é anônima por padrão." },
  { key: "bug", label: "Bug", icon: Bug, hint: "Conte o que aconteceu e em qual tela." },
  { key: "elogio", label: "Elogio", icon: Heart, hint: "O que está funcionando bem?" },
] as const;

type Cat = (typeof TABS)[number]["key"];

function SuggestionsPage() {
  const [cat, setCat] = useState<Cat>("melhoria");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useServerFn(submitFeedback);
  const qc = useQueryClient();
  const { data: mine } = useQuery({ queryKey: ["my-feedback"], queryFn: () => listMyFeedback({}) });

  const active = TABS.find((t) => t.key === cat)!;

  async function onSubmit() {
    const text = message.trim();
    if (text.length < 10) {
      setError("Escreva pelo menos 10 caracteres para a equipe entender.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res: any = await send({
        data: { category: cat, message: text, rating: rating ?? undefined, anonymous },
      });
      if (res?.error) throw new Error(res.error);
      toast.success(anonymous ? "Enviado anonimamente. Obrigado!" : "Enviado! A equipe vai te responder.");
      setMessage("");
      setRating(null);
      qc.invalidateQueries({ queryKey: ["my-feedback"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar agora.");
    }
    setSending(false);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Sugestões e críticas</h1>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-neon" /> No modo anônimo o envio não guarda nenhum vínculo com sua
          conta.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={cat === t.key}
            onClick={() => setCat(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition",
              cat === t.key
                ? "border-neon bg-neon/10 text-neon"
                : "border-border bg-card/40 text-muted-foreground hover:border-muted-foreground/50",
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <section className="mt-4 space-y-3 rounded-xl border border-border bg-card/60 p-4">
        <p className="font-mono text-[11px] text-muted-foreground">{active.hint}</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={1500}
          placeholder="Escreva aqui…"
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none transition focus:border-neon"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Nota</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? null : n)}
                className={cn(
                  "h-7 w-7 rounded border font-mono text-[11px] transition",
                  rating === n ? "border-neon bg-neon/10 text-neon" : "border-border text-muted-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-3.5 w-3.5 accent-[color:var(--neon,#22c55e)]"
            />
            Enviar anonimamente
          </label>
        </div>
        {error && (
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-neon px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-background transition hover:opacity-90 disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
        </button>
        <span className="block font-mono text-[10px] text-muted-foreground">{message.length}/1500</span>
      </section>

      {mine && mine.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Seus envios identificados</h2>
          <ul className="mt-2 space-y-2">
            {mine.map((f) => (
              <li key={f.id} className="rounded-lg border border-border bg-card/40 p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {f.category} · {new Date(f.created_at).toLocaleDateString("pt-BR")} · {f.status}
                </p>
                <p className="mt-1 text-xs text-foreground/90">{f.message}</p>
                {f.admin_note && (
                  <p className="mt-2 rounded border border-neon/30 bg-neon/5 p-2 font-mono text-[11px] text-neon">
                    Equipe: {f.admin_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
