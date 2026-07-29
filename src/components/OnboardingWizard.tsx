import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Terminal,
  VenetianMask,
  Target,
  MonitorSmartphone,
  Radar,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getAccountSetupState, completeOnboarding } from "@/lib/onboarding.functions";

type Choice = { value: string; label: string; hint?: string };

type Question = {
  key: string;
  icon: typeof Target;
  title: string;
  subtitle: string;
  choices: Choice[];
};

const QUESTIONS: Question[] = [
  {
    key: "goal",
    icon: Target,
    title: "O que você quer fazer aqui?",
    subtitle: "Usamos isso pra te mostrar só o que interessa no painel.",
    choices: [
      { value: "jogar", label: "Jogar com vantagem", hint: "Painel + login pronto pra usar" },
      { value: "revender", label: "Revender / indicar", hint: "Comissões e programa de indicação" },
      { value: "testar", label: "Só testar antes", hint: "Começar por um teste curto" },
      { value: "migrar", label: "Migrar de outro serviço", hint: "Trago meu tempo restante" },
    ],
  },
  {
    key: "experience",
    icon: Terminal,
    title: "Qual seu nível de experiência?",
    subtitle: "Ajustamos o nível de explicação nos tutoriais.",
    choices: [
      { value: "novato", label: "Primeira vez", hint: "Quero passo a passo" },
      { value: "intermediario", label: "Já usei antes", hint: "Sei o básico" },
      { value: "avancado", label: "Experiente", hint: "Vai direto ao ponto" },
    ],
  },
  {
    key: "device",
    icon: MonitorSmartphone,
    title: "Onde você vai usar?",
    subtitle: "Isso define os tutoriais e downloads que aparecem primeiro.",
    choices: [
      { value: "android", label: "Celular Android" },
      { value: "emulador", label: "Emulador no PC" },
      { value: "ambos", label: "Os dois" },
    ],
  },
  {
    key: "source",
    icon: Radar,
    title: "Como você chegou até nós?",
    subtitle: "Só pra saber onde investir — não compartilhamos com ninguém.",
    choices: [
      { value: "indicacao", label: "Indicação de amigo" },
      { value: "telegram", label: "Telegram / grupo" },
      { value: "youtube", label: "YouTube / TikTok" },
      { value: "google", label: "Google / pesquisa" },
      { value: "outro", label: "Outro" },
    ],
  },
];

type Props = {
  /** Chamado quando o cliente termina (ou pula) a configuração inicial. */
  onDone: () => void;
  /** Sincroniza o apelido escolhido com a página. */
  onDisplayName?: (nick: string | null) => void;
};

/** Marca local de conclusão (fallback quando o backend não consegue gravar). */
const doneKey = (userId: string) => `sd_onboarding_done_${userId}`;


export function OnboardingWizard({ onDone, onDisplayName }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0); // 0 = apelido, 1..n = perguntas, n+1 = resumo
  const [nick, setNick] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const checked = useRef(false);
  const loadState = useServerFn(getAccountSetupState);
  const saveState = useServerFn(completeOnboarding);

  const totalSteps = QUESTIONS.length + 2;

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      // Marca local: evita piscar o wizard antes da resposta do servidor.
      if (localStorage.getItem(doneKey(user.id))) {
        onDone();
        return;
      }
      // Fonte da verdade: estado gravado no servidor.
      const state: any = await loadState({});
      if (state?.onboardingDone) {
        localStorage.setItem(doneKey(user.id), "1");
        if (state.displayName) onDisplayName?.(state.displayName);
        onDone();
        return;
      }
      setNick(state?.displayName ?? "");
      setOpen(true);
    })().catch(() => onDone());
  }, [onDone, onDisplayName, loadState]);

  async function finish(skipped = false) {
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) throw new Error("Sessão expirada");
      const cleanNick = nick.trim();

      await saveState({ data: { displayName: cleanNick || undefined, answers, skipped } });
      localStorage.setItem(doneKey(user.id), "1");

      if (cleanNick) onDisplayName?.(cleanNick);
      if (!skipped) toast.success("Painel configurado — bem-vindo à Shadow");
    } catch (e: any) {
      console.error("[onboarding] falha ao salvar", e);
      toast.error("Não consegui salvar tudo agora, mas você já pode usar o painel normalmente.");
    } finally {
      setSaving(false);
      setOpen(false);
      onDone();
    }
  }


  const question = index >= 1 && index <= QUESTIONS.length ? QUESTIONS[index - 1] : null;
  const isSummary = index === totalSteps - 1;

  return (
    <Dialog open={open} onOpenChange={() => { /* fluxo obrigatório: só sai concluindo ou pulando */ }}>
      <DialogContent className="max-w-lg [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono uppercase tracking-wider">
            <Terminal className="h-5 w-5 text-neon" /> Configuração inicial
          </DialogTitle>
          <DialogDescription>
            Passo {index + 1} de {totalSteps} — leva menos de 1 minuto e só aparece uma vez.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= index ? "bg-neon" : "bg-border/60"}`}
            />
          ))}
        </div>

        {index === 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-border/60 bg-card/50 p-3">
              <VenetianMask className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
              <div>
                <div className="text-xs font-semibold">Escolha seu apelido</div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  Ele aparece no lugar do seu e-mail em todo o site, inclusive no suporte. Anonimato por padrão.
                </p>
              </div>
            </div>
            <Input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={24}
              placeholder="ex: shadow_ghost"
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Pode deixar em branco e definir depois no topo do painel.
            </p>
          </div>
        )}

        {question && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <question.icon className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
              <div>
                <div className="text-xs font-semibold">{question.title}</div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{question.subtitle}</p>
              </div>
            </div>
            <div className="grid gap-2">
              {question.choices.map((c) => {
                const active = answers[question.key] === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setAnswers((prev) => ({ ...prev, [question.key]: c.value }));
                      setTimeout(() => setIndex((i) => Math.min(i + 1, totalSteps - 1)), 120);
                    }}
                    className={`flex items-center justify-between rounded-md border p-3 text-left transition-colors ${
                      active
                        ? "border-neon bg-neon/10"
                        : "border-border/60 bg-card/40 hover:border-neon/50 hover:bg-card/70"
                    }`}
                  >
                    <span>
                      <span className="block text-xs font-semibold">{c.label}</span>
                      {c.hint && (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{c.hint}</span>
                      )}
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-neon" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isSummary && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
              <div>
                <div className="text-xs font-semibold">Tudo pronto</div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  Agora vamos ao último passo: gerar seus <span className="text-neon">códigos de recuperação</span>.
                  Eles são a única forma de recuperar a conta se você perder o acesso ao e-mail — a tela aparece logo
                  em seguida.
                </p>
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-black/30 p-3 font-mono text-[11px]">
              <div className="text-muted-foreground">// perfil</div>
              <div className="text-neon">apelido: {nick.trim() || "não definido"}</div>
              {QUESTIONS.map((q) => (
                <div key={q.key} className="text-neon">
                  {q.key}: {answers[q.key] ?? "—"}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {index > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={saving}
              className="font-mono uppercase"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Voltar
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!isSummary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (question ? setIndex((i) => i + 1) : finish(true))}
                disabled={saving}
                className="font-mono uppercase text-muted-foreground"
              >
                {question ? "Pular" : "Pular tudo"}
              </Button>
            )}
            {isSummary ? (
              <Button size="sm" onClick={() => finish(false)} disabled={saving} className="font-mono uppercase">
                {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Continuar para os códigos
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setIndex((i) => Math.min(i + 1, totalSteps - 1))}
                disabled={saving}
                className="font-mono uppercase"
              >
                Avançar <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
