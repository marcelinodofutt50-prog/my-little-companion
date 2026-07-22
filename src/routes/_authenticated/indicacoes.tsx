import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Copy, Gift, DollarSign, Calendar, Check, Loader2, Share2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyReferralInfo, updateReferralPref } from "@/lib/referrals.functions";
import { formatBrl } from "@/lib/plans";
import { PayoutsSection } from "@/components/PayoutsSection";

export const Route = createFileRoute("/_authenticated/indicacoes")({
  head: () => ({ meta: [{ title: "Indicações — Shadow" }] }),
  component: ReferralsPage,
});

type Info = Awaited<ReturnType<typeof getMyReferralInfo>>;
type Pref = "cashback" | "free_month" | "pix";

function ReferralsPage() {
  const infoFn = useServerFn(getMyReferralInfo);
  const prefFn = useServerFn(updateReferralPref);
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [pref, setPref] = useState<Pref>("cashback");
  const [pixKey, setPixKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const i = await infoFn();
      setInfo(i);
      setPref(i.pref);
      setPixKey(i.pixKey ?? "");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (pref === "pix" && !pixKey.trim()) {
      toast.error("Informe sua chave PIX para receber pagamentos.");
      return;
    }
    setSaving(true);
    try {
      await prefFn({ data: { pref, pixKey: pref === "pix" ? pixKey.trim() : null } });
      toast.success("Preferência salva");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  const shareLink = info?.code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/planos?ref=${info.code}`
    : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Não foi possível copiar"); }
  }

  async function share() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Shadow — Seu shadow em todo lugar",
          text: `Use meu cupom ${info?.code} e leve R$40 de cashback na sua primeira compra.`,
          url: shareLink,
        });
      } catch { /* user cancelled */ }
    } else { copyLink(); }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-neon/40 bg-neon/10">
            <Users className="h-5 w-5 text-neon" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold uppercase tracking-wider text-neon">Programa de Indicações</h1>
            <p className="text-xs text-muted-foreground">
              Indique alguém e ganhe <span className="text-neon">R$ 150</span> por cada compra que ela concluir.
            </p>
          </div>
        </div>

        {loading && (
          <div className="terminal-card p-8 text-center font-mono text-xs text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> carregando…
          </div>
        )}

        {!loading && info && (
          <>
            {/* Code + share */}
            <div className="terminal-card scanlines relative mb-6 p-6">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
                <Gift className="h-3 w-3 text-neon" /> seu código de indicação
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded border-2 border-neon/60 bg-neon/5 px-6 py-3 font-mono text-3xl font-bold tracking-widest text-neon shadow-[0_0_20px_rgba(0,255,180,0.3)]">
                  {info.code || "—"}
                </div>
                <div className="flex-1 min-w-[240px] space-y-2">
                  <div className="flex gap-2">
                    <Input readOnly value={shareLink} className="font-mono text-xs" />
                    <Button size="sm" onClick={copyLink} variant="ghost">
                      {copied ? <Check className="h-3 w-3 text-neon" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" onClick={share} variant="ghost">
                      <Share2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Compartilhe o link ou apenas o código. A pessoa digita <span className="font-mono text-neon">{info.code}</span> no checkout.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Indicações" value={String(info.stats.total)} icon={Users} color="text-neon" />
              <StatCard label="Recompensadas" value={String(info.stats.granted)} icon={Check} color="text-cyan" />
              <StatCard label="Pendentes" value={String(info.stats.pending)} icon={Calendar} color="text-amber-300" />
              <StatCard label="Cashback total" value={formatBrl(info.stats.cashback)} icon={DollarSign} color="text-violet-300" />
            </div>

            {/* Reward preference */}
            <div className="terminal-card scanlines relative mb-6 p-6">
              <div className="mb-4 font-mono text-xs uppercase text-neon">Como você quer receber?</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <RewardOption
                  active={pref === "cashback"} onClick={() => setPref("cashback")}
                  title="Cashback" desc="R$ 150 no seu saldo Shadow (usa em qualquer compra até 50% do valor)."
                  badge="Recomendado"
                />
                <RewardOption
                  active={pref === "free_month"} onClick={() => setPref("free_month")}
                  title="Mensalidade grátis" desc="+30 dias em todas as suas licenças ativas."
                />
                <RewardOption
                  active={pref === "pix"} onClick={() => setPref("pix")}
                  title="PIX R$ 150" desc="Pagamento manual em até 48h após a compra do indicado."
                />
              </div>
              {pref === "pix" && (
                <div className="mt-4">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Sua chave PIX</label>
                  <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="email, CPF, telefone ou chave aleatória" maxLength={120} />
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Salvar preferência
                </Button>
              </div>
            </div>

            {/* Payouts / redemption */}
            <PayoutsSection />

            {/* Referrals list */}
            <div className="terminal-card scanlines relative overflow-hidden">
              <div className="border-b border-border/40 bg-background/40 px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                Suas indicações
              </div>
              {info.referrals.length === 0 ? (
                <div className="p-8 text-center font-mono text-xs text-muted-foreground">
                  Ninguém usou seu código ainda. <Link to="/planos" className="text-neon hover:underline">Compartilhe agora</Link>.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 font-mono text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">Quando</th>
                      <th className="p-3 text-left">Indicado</th>
                      <th className="p-3 text-left">Recompensa</th>
                      <th className="p-3 text-left">Valor</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.referrals.map((r: any) => (
                      <tr key={r.id} className="border-b border-border/20">
                        <td className="p-3 font-mono text-[11px] whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="p-3 text-xs">{r.referred_email || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3 font-mono text-[11px] uppercase">{labelForReward(r.reward_type)}</td>
                        <td className="p-3 font-mono text-[11px]">{formatBrl(Number(r.reward_amount))}</td>
                        <td className={`p-3 font-mono text-[11px] uppercase ${statusColor(r.reward_status)}`}>{r.reward_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="terminal-card scanlines relative p-4">
      <Icon className={`mb-2 h-4 w-4 ${color}`} />
      <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
      <div className="font-mono text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function RewardOption({ active, onClick, title, desc, badge }: { active: boolean; onClick: () => void; title: string; desc: string; badge?: string }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`relative rounded border p-4 text-left transition-all ${active ? "border-neon/60 bg-neon/5 shadow-[0_0_15px_rgba(0,255,180,0.2)]" : "border-border/40 bg-background/40 hover:border-neon/30"}`}
    >
      {badge && <span className="absolute right-2 top-2 rounded bg-neon/20 px-2 py-0.5 font-mono text-[9px] uppercase text-neon">{badge}</span>}
      <div className={`mb-1 font-mono text-sm uppercase ${active ? "text-neon" : "text-foreground"}`}>{title}</div>
      <div className="text-[11px] text-muted-foreground">{desc}</div>
    </button>
  );
}

function labelForReward(t: string) {
  if (t === "cashback") return "Cashback";
  if (t === "free_month") return "Mensalidade";
  if (t === "pix") return "PIX";
  return t;
}
function statusColor(s: string) {
  if (s === "paid" || s === "granted") return "text-cyan";
  if (s === "pending") return "text-amber-300";
  return "text-muted-foreground";
}
