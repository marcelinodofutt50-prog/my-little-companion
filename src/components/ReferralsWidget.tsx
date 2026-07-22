import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Copy, Share2, Gift, DollarSign, Clock, Check, TrendingUp, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyReferralInfo } from "@/lib/referrals.functions";
import { formatBrl } from "@/lib/plans";

type Info = Awaited<ReturnType<typeof getMyReferralInfo>>;

export function ReferralsWidget() {
  const infoFn = useServerFn(getMyReferralInfo);
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    infoFn()
      .then((i) => setInfo(i))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [infoFn]);

  const link = info?.code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/planos?ref=${info.code}`
    : "";

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado — cole no WhatsApp, Telegram ou Discord");
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Não foi possível copiar"); }
  }

  async function share() {
    if (typeof navigator !== "undefined" && (navigator as any).share && info?.code) {
      try {
        await (navigator as any).share({
          title: "Shadow — Seu shadow em todo lugar",
          text: `Use meu cupom ${info.code} e leve 40% de cashback na 1ª compra.`,
          url: link,
        });
      } catch { /* cancelled */ }
    } else { copyLink(); }
  }

  const stats = info?.stats ?? { total: 0, granted: 0, pending: 0, cashback: 0 };
  const nextMilestone = stats.granted < 3 ? 3 : stats.granted < 10 ? 10 : stats.granted + 5;
  const progressPct = Math.min(100, Math.round((stats.granted / nextMilestone) * 100));
  const projected = stats.granted * 150; // R$150 por indicação convertida

  return (
    <div className="mb-6 rounded-lg border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-background to-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// programa de indicações</div>
          <h3 className="mt-0.5 truncate font-display text-lg font-semibold">
            Convide operadores. Ganhe R$ 150 por conversão.
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            Escolha receber em PIX, cashback ou +30 dias grátis · pago quando o convidado ativa uma licença paga.
          </p>
        </div>
        <Link to="/indicacoes" className="hidden shrink-0 sm:block">
          <Button size="sm" variant="outline" className="font-mono text-xs uppercase tracking-wider">
            Painel completo
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat icon={DollarSign} tone="ok" label="Saldo ganho" value={loading ? "…" : formatBrl(stats.cashback)} hint={`preferência: ${prefLabel(info?.pref)}`} />
        <MiniStat icon={TrendingUp} tone="brand" label="Projeção total" value={loading ? "…" : formatBrl(projected)} hint={`${stats.granted} conv. × R$150`} />
        <MiniStat icon={Check} tone="ok" label="Convites pagos" value={loading ? "…" : String(stats.granted)} hint="recompensa liberada" />
        <MiniStat icon={Clock} tone="muted" label="Pendentes" value={loading ? "…" : String(stats.pending)} hint="aguardando compra" />
      </div>

      {/* Progresso até próximo milestone */}
      <div className="mt-4">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Próximo marco · {stats.granted}/{nextMilestone} convites</span>
          <span className="text-primary/80">{progressPct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
          <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Link + CTAs */}
      <div className="mt-4 flex flex-col gap-2 rounded-md border border-border/60 bg-background/70 p-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Seu link</div>
          <div className="mt-0.5 truncate font-mono text-xs text-foreground">
            {loading ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> carregando…</span> : (link || "—")}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={copyLink} disabled={!link} className="font-mono text-xs uppercase tracking-wider">
            {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button size="sm" variant="outline" onClick={share} disabled={!link} className="font-mono text-xs uppercase tracking-wider">
            <Share2 className="mr-1 h-3.5 w-3.5" /> Compartilhar
          </Button>
        </div>
      </div>

      {/* Playbook de conversão */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Tip icon={Users} title="1. Segmente" body="Poste em grupos de OSINT, hacking e devs Android — público que já compra." />
        <Tip icon={Sparkles} title="2. Prove valor" body="Use o print da sua licença ativa e cite o SLA 99.9% para gerar confiança." />
        <Tip icon={Gift} title="3. Reforce o cupom" body="Diga que o cupom dá 40% de cashback na 1ª compra — reduz atrito na hora de fechar." />
      </div>

      <div className="mt-3 sm:hidden">
        <Link to="/indicacoes">
          <Button size="sm" variant="outline" className="w-full font-mono text-xs uppercase tracking-wider">
            Abrir painel completo
          </Button>
        </Link>
      </div>
    </div>
  );
}

function prefLabel(p?: "cashback" | "free_month" | "pix") {
  if (p === "pix") return "PIX";
  if (p === "free_month") return "+30 dias";
  return "cashback";
}

function MiniStat({
  icon: Icon, label, value, hint, tone = "muted",
}: { icon: any; label: string; value: string; hint: string; tone?: "ok" | "brand" | "muted" }) {
  const toneCls =
    tone === "ok" ? "text-emerald-300" :
    tone === "brand" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-background/60 p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-1 font-display text-xl font-semibold leading-none ${toneCls}`}>{value}</div>
      <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground/80">{hint}</div>
    </div>
  );
}

function Tip({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary/80">
        <Icon className="h-3 w-3" /> {title}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{body}</div>
    </div>
  );
}
