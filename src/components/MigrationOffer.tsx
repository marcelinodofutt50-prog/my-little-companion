import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, ServerCrash, ShieldCheck, Timer, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const COUPON = "MIGRA";

const pains = [
  { icon: ServerCrash, title: "Servidor caindo toda hora", body: "Rodamos em infra dedicada com monitoramento 24/7 e checagem automática de saúde do painel." },
  { icon: Timer, title: "Painel travando / lento", body: "Fluxo em tempo real e ativação automática em menos de 1 minuto — sem espera manual." },
  { icon: Users, title: "Cliente sumindo do painel", body: "Backup e histórico das suas licenças no seu dashboard, com aviso antes de vencer." },
  { icon: ShieldCheck, title: "Dono some quando dá problema", body: "Suporte humano por chat no painel, com ticket, histórico e reembolso em até 7 dias." },
];

export function MigrationOffer() {
  function copy() {
    navigator.clipboard.writeText(COUPON);
    localStorage.setItem("shadow_coupon", COUPON);
    toast.success(`Cupom ${COUPON} copiado`);
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
              onClick={() => {
                localStorage.setItem("shadow_coupon", COUPON);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Migrar agora <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

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
