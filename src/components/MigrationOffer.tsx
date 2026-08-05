import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, ServerCrash, ShieldCheck, Timer, Users, ArrowRight, Loader2, AlertTriangle, LogIn, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { listMyLicenses } from "@/lib/license.functions";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const COUPON = "MIGRA";
const MONTHLY_SLUGS = ["monthly_457"];

const pains = [
  { icon: ServerCrash, title: "Servidor caindo toda hora", body: "Rodamos em infra dedicada com monitoramento 24/7 e checagem automática de saúde do painel." },
  { icon: Timer, title: "Painel travando / lento", body: "Fluxo em tempo real e ativação automática em menos de 1 minuto — sem espera manual." },
  { icon: Users, title: "Cliente sumindo do painel", body: "Backup e histórico das suas licenças no seu dashboard, com aviso antes de vencer." },
  { icon: ShieldCheck, title: "Dono some quando dá problema", body: "Suporte humano por chat no painel, com ticket, histórico e reembolso em até 7 dias." },
];

type Notice = {
  kind: "auth" | "ineligible" | "ok";
  msg: string;
  reason?: string;
  fix?: string;
};

function isActiveMonthly(l: any) {
  if (!MONTHLY_SLUGS.includes(l.plan_slug)) return false;
  if (l.is_trial || l.revoked || l.disabled_at || l.suspended_at) return false;
  if (l.expires_at && new Date(l.expires_at).getTime() <= Date.now()) return false;
  return true;
}

/** Diagnóstico específico do porquê a licença mensal não serve para o upgrade. */
function diagnose(licenses: any[]): { reason: string; fix: string } {
  const monthly = (licenses ?? []).filter((l) => MONTHLY_SLUGS.includes(l.plan_slug));

  if (monthly.length === 0) {
    const hasLifetime = (licenses ?? []).some((l) => String(l.plan_slug ?? "").includes("46"));
    if (hasLifetime) {
      return {
        reason: "Você já tem uma licença Shadow 4.6 vitalícia — não existe upgrade a partir dela.",
        fix: "Nada a fazer: você já está na versão mais alta. Se precisa de outro login 4.6, compre um novo plano vitalício.",
      };
    }
    return {
      reason:
        (licenses ?? []).length === 0
          ? "Sua conta não tem nenhuma licença registrada."
          : "Você não tem nenhuma licença Shadow 4.5.7 (mensal / 30 dias) na conta — só planos de outro tipo.",
      fix: "Compre o plano Shadow 4.5.7 (mensal / 30 dias) acima. Com ele ativo, o upgrade para a 4.6 vitalícia é liberado na hora.",
    };
  }

  // Existe mensal: descobre o bloqueio mais relevante (prioriza o caso mais recuperável).
  const trial = monthly.find((l) => l.is_trial);
  const suspended = monthly.find((l) => l.suspended_at && !l.revoked && !l.disabled_at);
  const expired = monthly.find(
    (l) => l.expires_at && new Date(l.expires_at).getTime() <= Date.now() && !l.revoked && !l.disabled_at,
  );
  const disabled = monthly.find((l) => l.disabled_at && !l.revoked);
  const revoked = monthly.find((l) => l.revoked);

  if (suspended) {
    return {
      reason: "Sua licença 4.5.7 está PAUSADA (suspensa) no momento, e licença pausada não conta como ativa.",
      fix: "Volte no dashboard e clique em “Despausar login”. Assim que ela voltar a rodar, clique em “Migrar agora” de novo.",
    };
  }
  if (expired) {
    const when = expired.expires_at ? new Date(expired.expires_at).toLocaleDateString("pt-BR") : null;
    return {
      reason: `Sua licença 4.5.7 EXPIROU${when ? ` em ${when}` : ""} — o upgrade exige assinatura mensal dentro do prazo.`,
      fix: "Renove o plano mensal 4.5.7 acima. Com a renovação confirmada (ativação é automática após o PIX), o upgrade libera na hora.",
    };
  }
  if (trial) {
    return {
      reason: "A licença 4.5.7 que você tem é um TRIAL (teste gratuito), e trial não é elegível para o upgrade vitalício.",
      fix: "Compre o plano mensal 4.5.7 pago acima. Só assinaturas mensais compradas migram para a 4.6 vitalícia.",
    };
  }
  if (disabled) {
    return {
      reason: "Sua licença 4.5.7 está DESATIVADA no painel (fora de operação).",
      fix: "Abra um chamado no suporte para reativar a licença. Depois de reativada, o upgrade fica disponível.",
    };
  }
  if (revoked) {
    return {
      reason: "Sua licença 4.5.7 foi REVOGADA (cancelada, reembolsada ou removida por violação de uso).",
      fix: "Compre uma nova licença mensal 4.5.7 ou fale com o suporte para entender o motivo da revogação.",
    };
  }
  return {
    reason: "Sua licença 4.5.7 não está em estado ativo válido no momento.",
    fix: "Fale com o suporte informando o e-mail da conta — a equipe verifica o status e libera o upgrade se estiver tudo certo.",
  };
}

export function MigrationOffer() {
  const fetchMyLicenses = useServerFn(listMyLicenses);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function copy() {
    navigator.clipboard.writeText(COUPON);
    localStorage.setItem("shadow_coupon", COUPON);
    toast.success(`Cupom ${COUPON} copiado`);
  }

  async function handleMigrate() {
    setChecking(true);
    setNotice(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setNotice({
          kind: "auth",
          msg: "Entre na sua conta para verificarmos sua elegibilidade. O upgrade para a 4.6 vitalícia é liberado apenas para quem tem uma licença Shadow 4.5.7 (mensal) ativa comprada.",
        });
        return;
      }
      const licenses = (await fetchMyLicenses()) as any[];
      if (!(licenses ?? []).some(isActiveMonthly)) {
        setNotice({
          kind: "ineligible",
          msg: "Você não tem uma licença Shadow 4.5.7 (mensal / 30 dias) ativa. O upgrade para a 4.6 vitalícia é exclusivo para assinantes mensais ativos — compre o plano mensal primeiro, ou fale com o suporte se acha que isso é um engano.",
        });
        return;
      }
      setNotice({ kind: "ok", msg: "Elegibilidade confirmada — sua licença 4.5.7 está ativa. Cupom MIGRA aplicado, escolha o upgrade acima." });
      localStorage.setItem("shadow_coupon", COUPON);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao verificar elegibilidade");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="mt-16">
      <div className="terminal-card scanlines relative overflow-hidden p-6 sm:p-8">
        <div className="font-mono text-[11px] uppercase tracking-widest text-neon">Programa de migração</div>
        <h2 className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">
          Vem de outro servidor? A gente te acolhe.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Se você já paga em outro lugar e sofre com queda, travamento ou sumiço do suporte, não precisa pagar o
          valor cheio pra testar a Shadow. Use o cupom abaixo no primeiro pagamento e migre com desconto + cashback.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pains.map((p) => (
            <div key={p.title} className="flex items-start gap-3 rounded-md border border-border/60 bg-card/50 p-3">
              <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
              <div>
                <div className="text-xs font-semibold">{p.title}</div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider">
              Cupom <span className="text-neon">{COUPON}</span> — 20% off + 20% de cashback
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Válido no primeiro pagamento. O cashback volta como saldo pra próxima renovação.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copy} className="font-mono uppercase">
              <Copy className="mr-2 h-3.5 w-3.5" /> Copiar cupom
            </Button>
            <Button
              size="sm"
              className="font-mono uppercase"
              onClick={handleMigrate}
              disabled={checking}
            >
              {checking ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Migrar agora <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            role="alert"
            className={`mt-3 flex items-start gap-3 rounded-md border p-3 text-[12px] leading-snug ${
              notice.kind === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : notice.kind === "auth"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-destructive/50 bg-destructive/10 text-destructive-foreground"
            }`}
          >
            {notice.kind === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : notice.kind === "auth" ? (
              <LogIn className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="flex-1">
              <p>{notice.msg}</p>
              {notice.kind === "auth" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link to="/auth" className="font-mono text-[11px] uppercase text-primary hover:underline">
                    Entrar / criar conta →
                  </Link>
                </div>
              ) : null}
              {notice.kind === "ineligible" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href="#planos-grid"
                    className="font-mono text-[11px] uppercase text-primary hover:underline"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  >
                    Ver plano mensal 4.5.7 →
                  </a>
                  <Link to="/suporte" search={{}} className="font-mono text-[11px] uppercase text-primary hover:underline">
                    Falar com suporte →
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-[11px] text-muted-foreground">
          Quer ver o checklist do que enviar, os prazos do suporte e as dúvidas mais comuns?{" "}
          <Link to="/migracao" className="text-primary hover:underline">Detalhes do programa de migração</Link>. Ou abra
          um chamado direto em <Link to="/suporte" search={{}} className="text-primary hover:underline">/suporte</Link> que a
          equipe acompanha a migração com você, passo a passo.
        </p>

      </div>
    </section>
  );
}
