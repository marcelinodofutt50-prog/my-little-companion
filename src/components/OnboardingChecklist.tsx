import { useEffect, useState } from "react";
import { CheckCircle2, Circle, LayoutDashboard, ShieldCheck, Copy, LifeBuoy } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

const STORAGE_KEY = "shadow-onboarding-v1";
const HIDDEN_KEY = "shadow-onboarding-hidden-v1";
const EVENT = "shadow-onboarding-change";


export const ONBOARDING_STEP = {
  DASHBOARD: 0,
  LICENSE: 1,
  CREDENTIALS: 2,
  SUPPORT: 3,
} as const;

function loadCompleted(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

function saveCompleted(next: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Marca um passo do onboarding como concluído de qualquer lugar do app. */
export function markOnboardingStep(id: number) {
  if (typeof window === "undefined") return;
  const current = loadCompleted();
  if (current.includes(id)) return;
  saveCompleted([...current, id]);
}

const STEPS = [
  { id: ONBOARDING_STEP.DASHBOARD, label: "Acessar o dashboard", icon: LayoutDashboard, hint: "Concluído automaticamente" },
  { id: ONBOARDING_STEP.LICENSE, label: "Ver licença ativa", icon: ShieldCheck, hint: "Ir para suas licenças" },
  { id: ONBOARDING_STEP.CREDENTIALS, label: "Copiar credenciais", icon: Copy, hint: "Copiar usuário e senha" },
  { id: ONBOARDING_STEP.SUPPORT, label: "Abrir suporte se necessário", icon: LifeBuoy, hint: "Falar com o time" },
] as const;

export function OnboardingChecklist({
  hasActiveLicense = false,
  onGoToLicense,
  onCopyCredentials,
}: {
  hasActiveLicense?: boolean;
  onGoToLicense?: () => void;
  onCopyCredentials?: () => boolean | void;
}) {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState(true); // esconde até saber o estado salvo

  function hideForGood() {
    try { localStorage.setItem(HIDDEN_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  // Passo 1: acessar o dashboard conclui sozinho ao montar.
  useEffect(() => {
    let hidden = false;
    try { hidden = localStorage.getItem(HIDDEN_KEY) === "1"; } catch { /* ignore */ }
    setDismissed(hidden);
    markOnboardingStep(ONBOARDING_STEP.DASHBOARD);
    setCompleted(loadCompleted());
    const sync = () => setCompleted(loadCompleted());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);


  // Passo 2: se já existe licença ativa e o usuário está vendo o painel, conclui.
  useEffect(() => {
    if (hasActiveLicense) markOnboardingStep(ONBOARDING_STEP.LICENSE);
  }, [hasActiveLicense]);

  function runStep(id: number) {
    if (id === ONBOARDING_STEP.DASHBOARD) {
      markOnboardingStep(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (id === ONBOARDING_STEP.LICENSE) {
      if (!hasActiveLicense) {
        toast.info("Você ainda não tem licença ativa — escolha um plano para ativar.");
        navigate({ to: "/planos" });
        return;
      }
      markOnboardingStep(id);
      onGoToLicense?.();
      return;
    }
    if (id === ONBOARDING_STEP.CREDENTIALS) {
      const ok = onCopyCredentials?.();
      if (ok === false) {
        toast.info("Nenhuma credencial disponível ainda.");
        return;
      }
      markOnboardingStep(id);
      return;
    }
    markOnboardingStep(ONBOARDING_STEP.SUPPORT);
    navigate({ to: "/suporte", search: {} as any });
  }

  const doneCount = STEPS.filter((s) => completed.includes(s.id)).length;
  const pct = Math.round((doneCount / STEPS.length) * 100);
  const allDone = doneCount === STEPS.length;

  // Concluiu tudo? mostra o "parabéns" por alguns segundos e some de vez.
  useEffect(() => {
    if (!allDone || dismissed) return;
    const t = setTimeout(() => hideForGood(), 6000);
    return () => clearTimeout(t);
  }, [allDone, dismissed]);

  if (dismissed) return null;





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
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {doneCount}/{STEPS.length} concluídos · clique em cada passo para executá-lo
          </p>
        </div>
        <button
          onClick={hideForGood}
          className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ocultar
        </button>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full border border-border/40 bg-background/60">
        <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {STEPS.map((step) => {
          const isDone = completed.includes(step.id);
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              title={step.hint}
              onClick={() => runStep(step.id)}
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
