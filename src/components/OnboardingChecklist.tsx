import { useEffect, useState } from "react";
import { CheckCircle2, Circle, LayoutDashboard, ShieldCheck, Copy, LifeBuoy } from "lucide-react";
import { motion } from "framer-motion";

const STORAGE_KEY = "shadow-onboarding-v1";

const STEPS = [
  { id: 0, label: "Acessar o dashboard", icon: LayoutDashboard },
  { id: 1, label: "Ver licença ativa", icon: ShieldCheck },
  { id: 2, label: "Copiar credenciais", icon: Copy },
  { id: 3, label: "Abrir suporte se necessário", icon: LifeBuoy },
] as const;

function loadCompleted(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function OnboardingChecklist({
  completed: completedProp,
  onCheck,
}: {
  completed?: number[];
  onCheck?: (id: number, done: boolean) => void;
}) {
  const [completed, setCompleted] = useState<number[]>(() => completedProp ?? loadCompleted());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (completedProp) setCompleted(completedProp);
  }, [completedProp]);

  useEffect(() => {
    if (!completedProp) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    }
  }, [completed, completedProp]);

  function toggle(id: number) {
    const isDone = completed.includes(id);
    const next = isDone ? completed.filter((x) => x !== id) : [...completed, id];
    setCompleted(next);
    onCheck?.(id, !isDone);
  }

  if (dismissed) return null;

  const doneCount = completed.length;
  const pct = Math.round((doneCount / STEPS.length) * 100);
  const allDone = doneCount === STEPS.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="terminal-card scanlines relative mt-5 overflow-hidden rounded-lg border border-neon/30 bg-neon/[0.03] p-5"
    >
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-neon to-transparent" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-neon/80">// primeiros passos</div>
          <h3 className="mt-1 font-display text-base font-semibold text-foreground">
            {allDone ? "Você concluiu o onboarding! 🎉" : "Bem-vindo(a) — vamos configurar sua conta"}
          </h3>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ocultar
        </button>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background/60 border border-border/40">
        <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {STEPS.map((step) => {
          const isDone = completed.includes(step.id);
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => toggle(step.id)}
              className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left font-mono text-xs transition-colors ${
                isDone
                  ? "border-neon/40 bg-neon/10 text-neon"
                  : "border-border/40 bg-background/40 text-muted-foreground hover:border-neon/30 hover:text-foreground"
              }`}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className={isDone ? "line-through decoration-neon/50" : ""}>{step.label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
