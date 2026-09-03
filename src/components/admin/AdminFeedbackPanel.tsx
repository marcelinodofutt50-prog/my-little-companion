import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bug, Heart, Lightbulb, Loader2, MessageSquareWarning, Send, ShieldCheck } from "lucide-react";
import { adminListFeedback, adminUpdateFeedback, type AdminFeedbackItem } from "@/lib/feedback.functions";
import { cn } from "@/lib/utils";

const CAT_META: Record<string, { label: string; icon: any }> = {
  melhoria: { label: "Melhoria", icon: Lightbulb },
  critica: { label: "Crítica", icon: MessageSquareWarning },
  bug: { label: "Bug", icon: Bug },
  elogio: { label: "Elogio", icon: Heart },
};

const STATUSES = [
  { key: "all", label: "Todos" },
  { key: "new", label: "Novos" },
  { key: "reviewed", label: "Em análise" },
  { key: "done", label: "Resolvidos" },
] as const;

const CATS = [
  { key: "all", label: "Todas" },
  { key: "melhoria", label: "Melhoria" },
  { key: "critica", label: "Crítica" },
  { key: "bug", label: "Bug" },
  { key: "elogio", label: "Elogio" },
] as const;

export function AdminFeedbackPanel() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]["key"]>("all");
  const [category, setCategory] = useState<(typeof CATS)[number]["key"]>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const list = useServerFn(adminListFeedback);
  const update = useServerFn(adminUpdateFeedback);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-feedback", status, category],
    queryFn: () => list({ data: { status, category } }) as Promise<AdminFeedbackItem[]>,
  });

  const mutate = useMutation({
    mutationFn: (vars: { id: string; status?: string; admin_note?: string }) =>
      update({ data: vars as any }),
    onSuccess: (res: any) => {
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Feedback atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-feedback"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar."),
  });

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Sugestões e críticas</h2>
        <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Envios anônimos não guardam vínculo com a conta — não é
          possível identificar quem enviou.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition",
              status === s.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card/40 text-muted-foreground hover:border-muted-foreground/50",
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition",
              category === c.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card/40 text-muted-foreground hover:border-muted-foreground/50",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-10 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando feedbacks…
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 font-mono text-[11px] text-destructive">
          {(error as any)?.message ?? "Não foi possível carregar."}
        </p>
      )}

      {data && data.length === 0 && (
        <p className="rounded-lg border border-border bg-card/40 p-8 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Nenhum feedback neste filtro.
        </p>
      )}

      <ul className="space-y-3">
        {(data ?? []).map((f) => {
          const meta = CAT_META[f.category] ?? { label: f.category, icon: Lightbulb };
          const Icon = meta.icon;
          return (
            <li key={f.id} className="rounded-lg border border-border bg-card/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {new Date(f.created_at).toLocaleString("pt-BR")}
                </span>
                {f.rating != null && (
                  <span className="font-mono text-[10px] text-muted-foreground">nota {f.rating}/5</span>
                )}
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {f.is_anonymous ? "anônimo" : (f.user_email ?? f.user_name ?? "identificado")}
                </span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {f.status}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{f.message}</p>

              {f.admin_note && (
                <p className="mt-2 rounded border border-primary/30 bg-primary/5 p-2 font-mono text-[11px] text-primary">
                  Equipe: {f.admin_note}
                </p>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={notes[f.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [f.id]: e.target.value }))}
                  placeholder={f.is_anonymous ? "Anotação interna…" : "Resposta para o cliente…"}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none transition focus:border-primary"
                />
                <button
                  type="button"
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate({ id: f.id, admin_note: notes[f.id] ?? "", status: "reviewed" })}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-primary transition hover:bg-primary/20 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" /> Salvar
                </button>
                <button
                  type="button"
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate({ id: f.id, status: "done" })}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition hover:border-muted-foreground/60 disabled:opacity-60"
                >
                  Resolver
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AdminFeedbackPanel;
