import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Copy, Zap, Server, Ticket, Clock, ShieldAlert, Loader2, LifeBuoy, LogOut, Eye, EyeOff, Sparkles, Terminal as TerminalIcon, Pause, Play, PowerOff, Check, X, Crown, Shield, AlertTriangle, BellRing, Download, Archive, ChevronDown } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ReferralsWidget } from "@/components/ReferralsWidget";
import { LegacyConnectPanel } from "@/components/LegacyConnectPanel";
import { TutorialHintDialog } from "@/components/TutorialHintDialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl, tierFromPlanSlug, tierLabel, tierAccent, getTierFeatures, serverFeeFor, downloadsForTier, type VersionTier } from "@/lib/plans";
import { listMyLicenses, generateTrial, getMyCashbackBalance, suspendMyLicense, reactivateMyLicense, disableMyLicense } from "@/lib/license.functions";
import { detectLegacyForCurrentUser, getMyLegacyStatus } from "@/lib/legacy-detect.functions";
import { createCheckout } from "@/lib/checkout.functions";
import { listMyUpdates, getUpdateDownloadUrl } from "@/lib/updates.functions";
import { daysUntil, severityFromDays, severityColor, type ExpirySeverity } from "@/lib/expiry";
import shadowMark from "@/assets/shadow-mask.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Shadow" }] }),
  component: DashboardPage,
});

type License = {
  id: string; plan_slug: string;
  yaarsa_username: string; yaarsa_email: string;
  password: string; server_ip: string;
  expires_at: string | null; server_paid_until: string | null;
  revoked: boolean; is_trial: boolean; created_at: string;
  suspended_at: string | null; suspended_by: string | null;
  expires_at_before_suspend: string | null; disabled_at: string | null;
  version_tier: VersionTier | null;
  is_legacy: boolean | null;
  legacy_server_fee_brl: number | null;
};


function DashboardPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [balance, setBalance] = useState(0);
  const [email, setEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [trialCreds, setTrialCreds] = useState<null | { username: string; email: string; password: string; server_ip: string; expires_at: string | null; retried?: boolean }>(null);
  const [trialHidden, setTrialHidden] = useState(false);
  const [trialShowPw, setTrialShowPw] = useState(false);
  const [trialShowIp, setTrialShowIp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [licFilter, setLicFilter] = useState<"all" | "active" | "trial" | "archived">("active");
  const [licSort, setLicSort] = useState<"expires_asc" | "expires_desc" | "created_desc" | "created_asc">("expires_asc");
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const listFn = useServerFn(listMyLicenses);
  const trialFn = useServerFn(generateTrial);
  const cashFn = useServerFn(getMyCashbackBalance);
  const detectFn = useServerFn(detectLegacyForCurrentUser);
  const legacyStatusFn = useServerFn(getMyLegacyStatus);
  const checkoutFn = useServerFn(createCheckout);
  const [legacyStatus, setLegacyStatus] = useState<string>("unchecked");
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const [l, c] = await Promise.all([listFn(), cashFn()]);
      const list = l as License[];
      setLicenses(list); setBalance(c.balance);
      // Hydrate trial credentials card from server-stored (encrypted) license
      // so it survives reloads / device switches.
      const trial = list.find((x) => x.is_trial);
      if (trial) {
        setTrialCreds((prev) => prev ?? {
          username: trial.yaarsa_username,
          email: trial.yaarsa_email,
          password: trial.password,
          server_ip: trial.server_ip,
          expires_at: trial.expires_at,
          retried: true,
        });
      }
    } catch (e: any) { toast.error(e.message); }
    setRefreshing(false);
  }


  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        const { data: role } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
        setIsAdmin(!!role);
        // Scope realtime to just this user so unrelated license mutations
        // (other clients, admin batch operations) don't force a refetch.
        ch = supabase.channel(`licenses:${data.user.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "licenses", filter: `user_id=eq.${data.user.id}` }, () => refresh())
          .subscribe();
      }
    });
    refresh();
    // Load cached legacy status, then re-detect in background (cheap when cache is fresh).
    legacyStatusFn().then((r) => setLegacyStatus(r.status)).catch(() => {});
    detectFn().then((r) => setLegacyStatus(r.status)).catch(() => {});
    return () => { if (ch) supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startUpgrade() {
    setUpgradeLoading(true);
    try {
      const res = await checkoutFn({ data: { planSlug: "upgrade-457-to-46", returnOrigin: window.location.origin } });
      const url = res.initPoint || res.sandboxInitPoint;
      if (!url) throw new Error("Não foi possível iniciar o checkout");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar upgrade");
      setUpgradeLoading(false);
    }
  }

  async function generate() {
    setTrialLoading(true);
    setTrialError(null);
    try {
      const res = await trialFn();
      setTrialCreds({
        username: res.username, email: res.email, password: res.password,
        server_ip: res.server_ip, expires_at: res.expires_at, retried: !!res.retried,
      });
      setTrialHidden(false);
      await refresh();
      toast.success(
        res?.retried ? "Conta ativa! Trial recuperado com sucesso." : "Conta ativa! Trial provisionado no servidor.",
        { description: `user: ${res.username} • expira em ${res.expires_at ? new Date(res.expires_at).toLocaleString() : "24h"}` }
      );
      setTutorialOpen(true);
    } catch (e: any) {
      setTrialError(e?.message ?? "Falha ao gerar trial");
      toast.error(e?.message ?? "Falha ao gerar trial");
    }
    setTrialLoading(false);
  }


  function copyText(v: string, label: string) { navigator.clipboard.writeText(v); toast.success(`${label} copiado`); }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar isAdmin={isAdmin} />
        <SidebarInset className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
            <SidebarTrigger className="text-muted-foreground hover:text-primary" />
            <div className="h-6 w-px bg-border/60" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// dashboard</div>
              <div className="truncate font-display text-sm text-foreground">{email || "operator"}</div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/planos"><Button size="sm" variant="ghost" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Planos</Button></Link>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
            {(() => {
              const active = licenses.filter((l) => !l.revoked && !l.disabled_at && !l.suspended_at && (!l.expires_at || new Date(l.expires_at) > new Date()));
              const nextExp = active
                .map((l) => (l.expires_at ? new Date(l.expires_at).getTime() : Infinity))
                .sort((a, b) => a - b)[0];
              const daysLeft = nextExp && isFinite(nextExp) ? Math.max(0, Math.ceil((nextExp - Date.now()) / 86400000)) : null;
              const primary = active.find((l) => !l.is_trial) ?? active[0];
              const copyPrimary = () => {
                if (!primary) { toast.info("Nenhuma licença ativa para copiar"); return; }
                navigator.clipboard.writeText(
                  `user: ${primary.yaarsa_username}\nemail: ${primary.yaarsa_email}\npass: ${primary.password}\nserver: ${primary.server_ip}`
                );
                toast.success("Credenciais copiadas");
              };
              const statusTone = daysLeft === null ? "muted" : daysLeft <= 2 ? "danger" : daysLeft <= 5 ? "amber" : "neon";
              const statusColor = statusTone === "danger" ? "text-danger" : statusTone === "amber" ? "text-amber-400" : statusTone === "neon" ? "text-neon" : "text-muted-foreground";
              const statusRing = statusTone === "danger" ? "border-danger/50 bg-danger/5" : statusTone === "amber" ? "border-amber-400/40 bg-amber-400/5" : statusTone === "neon" ? "border-neon/40 bg-neon/5" : "border-border/50 bg-background/40";
              return (
                <div className="relative overflow-hidden rounded-lg border border-border/50 bg-gradient-to-br from-background via-background to-neon/[0.04] p-5 sm:p-6">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[var(--neon)] opacity-[0.08] blur-3xl" />
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="relative shrink-0">
                        <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[var(--neon)] opacity-25 blur-xl" />
                        <img src={shadowMark} alt="Shadow" className="h-12 w-12 object-contain drop-shadow-[0_0_18px_rgba(201,168,76,0.55)] md:h-14 md:w-14" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-neon/80">// operator</div>
                        <h1 className="mt-0.5 truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">{email || "—"}</h1>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          sessão · {new Date().toLocaleDateString("pt-BR")} · {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className={`shrink-0 rounded-md border px-3 py-2 text-right font-mono ${statusRing}`}>
                      <div className={`text-[9px] uppercase tracking-[0.2em] ${statusColor}`}>
                        {daysLeft === null ? "sem licença" : daysLeft === 0 ? "expira hoje" : "próxima expiração"}
                      </div>
                      <div className={`text-lg font-bold leading-none ${statusColor}`}>
                        {daysLeft === null ? "—" : `${daysLeft}d`}
                      </div>
                      <div className="mt-0.5 text-[9px] text-muted-foreground">
                        {active.length} ativa{active.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  {/* Quick action bar */}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-3">
                    <Button size="sm" variant="outline" onClick={copyPrimary} disabled={!primary} className="font-mono text-[11px] uppercase tracking-wider">
                      <Copy className="mr-1.5 h-3 w-3" /> Copiar credenciais
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setTutorialOpen(true)} className="font-mono text-[11px] uppercase tracking-wider">
                      <Sparkles className="mr-1.5 h-3 w-3 text-neon" /> Tutorial
                    </Button>
                    <Link to="/suporte">
                      <Button size="sm" variant="outline" className="font-mono text-[11px] uppercase tracking-wider">
                        <LifeBuoy className="mr-1.5 h-3 w-3" /> Suporte
                      </Button>
                    </Link>
                    <Link to="/planos">
                      <Button size="sm" className="font-mono text-[11px] uppercase tracking-wider">
                        <Sparkles className="mr-1.5 h-3 w-3" /> {daysLeft !== null && daysLeft <= 5 ? "Renovar agora" : "Comprar"}
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing} className="ml-auto font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {refreshing && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                      Atualizar
                    </Button>
                  </div>
                </div>
              );
            })()}

        <ExpiryAlerts licenses={licenses} />

        {/* STATS — faixa compacta */}
        {(() => {
          const active = licenses.filter((l) => !l.revoked && !l.disabled_at && !l.suspended_at && (!l.expires_at || new Date(l.expires_at) > new Date()));
          const nextExp = active
            .map((l) => (l.expires_at ? new Date(l.expires_at).getTime() : Infinity))
            .sort((a, b) => a - b)[0];
          const daysLeft = nextExp && isFinite(nextExp) ? Math.max(0, Math.ceil((nextExp - Date.now()) / 86400000)) : null;
          return (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <StatCard icon={Server} accent="neon" label="Licenças ativas" value={String(active.length)} />
              <StatCard icon={Clock} accent={daysLeft !== null && daysLeft <= 3 ? "violet" : "cyan"} label="Próxima expiração" value={daysLeft === null ? "—" : `${daysLeft}d`} />
              <StatCard icon={Ticket} accent="cyan" label="Cashback" value={formatBrl(balance)} />
              <StatCard icon={Zap} accent="neon" label="Servidor" value="ONLINE" pulse />
            </div>
          );
        })()}

        {/* UPGRADE v4.5.7 → v4.6 — só aparece para clientes antigos v457 que ainda não estão na v46 */}
        {(legacyStatus === "v457") && !licenses.some((l) => l.plan_slug === "login-lifetime" && !l.disabled_at) && (
          <div className="mt-5 terminal-card scanlines relative flex flex-col gap-3 rounded-md border border-violet/40 bg-violet/5 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Crown className="h-5 w-5 shrink-0 text-violet" />
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-violet">Detectamos sua conta antiga na v4.5.7</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Atualize por <span className="font-semibold text-foreground">R$ 600</span> e migre automaticamente para a <span className="text-foreground">Shadow 4.6</span> — updates grátis, prioridade no suporte e novas ferramentas. Sua licença antiga é desativada assim que o pagamento é aprovado.
                </div>
              </div>
            </div>
            <Button onClick={startUpgrade} disabled={upgradeLoading} className="font-mono uppercase tracking-wider md:shrink-0">
              {upgradeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atualizar para v4.6
            </Button>
          </div>
        )}

        {/* TRIAL */}
        {!licenses.some((l) => l.is_trial) && !trialCreds && (
          <div className="mt-5 terminal-card rgb-border scanlines relative p-6">
            <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs uppercase text-neon"><Sparkles className="h-4 w-4" />trial exclusivo</div>
                <h3 className="mt-1 text-lg font-semibold">Gerar 1 dia grátis</h3>
                <p className="text-sm text-muted-foreground">Um trial por conta. Credencial única, criada no servidor.</p>
              </div>
              <Button size="lg" onClick={generate} disabled={trialLoading} className="font-mono uppercase tracking-wider">
                {trialLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {trialError ? "Tentar novamente" : "Gerar Trial"}
              </Button>
            </div>
            {trialError && (
              <div className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-3 font-mono text-xs text-destructive">
                <div className="mb-1 uppercase tracking-wider">// falha ao criar credenciais</div>
                <div className="text-destructive/90">{trialError}</div>
                <div className="mt-2 text-[10px] text-destructive/70">
                  Idempotência ativa — retentativas reutilizam a mesma credencial e não duplicam licenças.
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRIAL CREDENTIALS — highlight (persisted server-side, reopenable) */}
        {trialCreds && trialHidden && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded border border-neon/30 bg-neon/5 px-4 py-3 font-mono text-xs">
            <span className="text-neon">// credenciais do trial salvas no cofre</span>
            <Button size="sm" variant="outline" onClick={() => setTrialHidden(false)} className="font-mono text-xs uppercase">
              <Eye className="mr-1 h-3 w-3" /> Reabrir credenciais
            </Button>
          </div>
        )}
        {trialCreds && !trialHidden && (

          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-5 terminal-card rgb-border scanlines relative overflow-hidden p-6"
          >
            <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-neon to-transparent" />
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neon">
                  <Sparkles className="h-4 w-4" />
                  {trialCreds.retried ? "trial recuperado" : "trial criado com sucesso"}
                </div>
                <h3 className="mt-1 text-lg font-semibold">Suas credenciais de acesso</h3>
                <p className="text-xs text-muted-foreground">
                  Guarde esses dados — a senha só é exibida em texto claro aqui e no card da licença.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <TrialCountdown expiresAt={trialCreds.expires_at} />
                <Button size="sm" variant="ghost" onClick={() => setTrialHidden(true)} className="font-mono text-xs uppercase self-start">Fechar</Button>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
              <div className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
              <div className="font-mono text-xs">
                <div className="uppercase tracking-wider text-emerald-300">✓ conta ativa</div>
                <div className="mt-0.5 text-emerald-200/80">
                  Login liberado para <span className="text-emerald-100">{trialCreds.username}</span> — use as credenciais abaixo no cliente Shadow.
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 font-mono text-xs sm:grid-cols-2 sm:gap-2">

              <Field label="Usuário" value={trialCreds.username} onCopy={() => copyText(trialCreds.username, "Usuário")} />
              <Field label="E-mail" value={trialCreds.email} onCopy={() => copyText(trialCreds.email, "Email")} />
              <Field
                label="Senha"
                value={trialShowPw ? trialCreds.password : "•".repeat(Math.min(trialCreds.password.length, 12))}
                onCopy={() => copyText(trialCreds.password, "Senha")}
                right={
                  <button onClick={() => setTrialShowPw(!trialShowPw)} className="text-muted-foreground hover:text-neon">
                    {trialShowPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                }
              />
              <Field
                label="Servidor"
                value={trialShowIp ? trialCreds.server_ip : "•••.•••.•••.•••"}
                onCopy={() => { if (!trialShowIp) { toast.info("Revele o IP primeiro"); return; } copyText(trialCreds.server_ip, "IP"); }}
                right={
                  <button onClick={() => setTrialShowIp(!trialShowIp)} className="text-muted-foreground hover:text-neon">
                    {trialShowIp ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                }
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
              <Button
                size="sm" variant="outline" className="font-mono text-xs uppercase"
                onClick={() => copyText(
                  `user: ${trialCreds.username}\nemail: ${trialCreds.email}\npass: ${trialCreds.password}\nserver: ${trialCreds.server_ip}`,
                  "Credenciais"
                )}
              >
                <Copy className="mr-1 h-3 w-3" /> Copiar tudo
              </Button>
              <span className="font-mono text-[10px] text-muted-foreground">
                Use no cliente Shadow com o IP do servidor para conectar.
              </span>
            </div>
          </motion.div>
        )}

        {/* LICENSES */}
        {(() => {
          const isArchived = (l: License) =>
            !!l.disabled_at || !!l.revoked ||
            (!!l.expires_at && new Date(l.expires_at).getTime() < Date.now() && l.plan_slug !== "login-lifetime");
          const categoryOf = (l: License): "active" | "trial" | "archived" => {
            if (isArchived(l)) return "archived";
            if (l.is_trial) return "trial";
            return "active";
          };
          const activeCount = licenses.filter((l) => categoryOf(l) === "active").length;
          const trialCount = licenses.filter((l) => categoryOf(l) === "trial").length;
          const archivedCount = licenses.filter((l) => categoryOf(l) === "archived").length;

          const sortFn = (a: License, b: License) => {
            const expA = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
            const expB = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
            const crA = new Date(a.created_at).getTime();
            const crB = new Date(b.created_at).getTime();
            switch (licSort) {
              case "expires_asc": return expA - expB;
              case "expires_desc": return expB - expA;
              case "created_desc": return crB - crA;
              case "created_asc": return crA - crB;
            }
          };

          const filtered = licenses.filter((l) => licFilter === "all" ? true : categoryOf(l) === licFilter);
          const sorted = [...filtered].sort(sortFn);

          const tabs = [
            { k: "active", label: `ativas · ${activeCount}` },
            { k: "trial", label: `trials · ${trialCount}` },
            { k: "archived", label: `arquivadas · ${archivedCount}` },
            { k: "all", label: `todas · ${licenses.length}` },
          ] as const;

          const sortOptions = [
            { k: "expires_asc", label: "expira ↑" },
            { k: "expires_desc", label: "expira ↓" },
            { k: "created_desc", label: "novas" },
            { k: "created_asc", label: "antigas" },
          ] as const;

          const groups: { key: "active" | "trial" | "archived"; label: string; icon: any }[] = [
            { key: "active", label: "ativas", icon: Zap },
            { key: "trial", label: "trials", icon: Sparkles },
            { key: "archived", label: "arquivadas", icon: Archive },
          ];

          return (
            <section className="mt-10">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// suas licenças</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex overflow-hidden rounded border border-border/40 bg-background/40 font-mono text-[10px] uppercase tracking-wider">
                    {tabs.map((t) => (
                      <button key={t.k} onClick={() => setLicFilter(t.k)}
                        className={`px-2.5 py-1 transition-colors ${licFilter === t.k ? "bg-neon/15 text-neon" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex overflow-hidden rounded border border-border/40 bg-background/40 font-mono text-[10px] uppercase tracking-wider">
                    {sortOptions.map((s) => (
                      <button key={s.k} onClick={() => setLicSort(s.k)}
                        className={`px-2.5 py-1 transition-colors ${licSort === s.k ? "bg-cyan/15 text-cyan" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing}>{refreshing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Atualizar</Button>
                </div>
              </div>
              {licenses.length === 0 ? (
                <div className="terminal-card scanlines relative p-10 text-center text-muted-foreground">
                  <TerminalIcon className="mx-auto mb-2 h-8 w-8 text-neon" />
                  Nenhuma licença ainda. <Link to="/planos" className="text-neon hover:underline">Ver planos →</Link>
                </div>
              ) : sorted.length === 0 ? (
                <div className="terminal-card scanlines relative flex flex-col items-center gap-1 p-8 text-center font-mono text-xs text-muted-foreground">
                  {licFilter === "archived" && <Archive className="mb-1 h-6 w-6 text-muted-foreground/60" />}
                  {licFilter === "active" && "Nenhuma licença ativa no momento."}
                  {licFilter === "trial" && "Nenhum trial ativo."}
                  {licFilter === "archived" && "Nenhuma licença arquivada."}
                </div>
              ) : licFilter === "all" ? (
                <div className="space-y-6">
                  {groups.map((g) => {
                    const items = sorted.filter((l) => categoryOf(l) === g.key);
                    if (items.length === 0) return null;
                    const Icon = g.icon;
                    return (
                      <div key={g.key}>
                        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                          <Icon className="h-3 w-3" />
                          <span>{g.label}</span>
                          <span className="text-muted-foreground/60">· {items.length}</span>
                          <div className="ml-2 h-px flex-1 bg-border/40" />
                        </div>
                        <div className="space-y-3">
                          {items.map((l, i) => <LicenseCard key={l.id} lic={l} onChanged={refresh} defaultOpen={i === 0 && g.key === "active"} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {sorted.map((l, i) => <LicenseCard key={l.id} lic={l} onChanged={refresh} defaultOpen={i === 0 && licFilter === "active"} />)}
                </div>
              )}
            </section>
          );
        })()}

        {/* DOWNLOADS — depois das licenças */}
        <DownloadsSection licenses={licenses} isAdmin={isAdmin} />

        {/* BRIEFING EXECUTIVO + INDICAÇÕES + LEGACY — extras ao final */}
        <div className="mt-8">
          <BusinessBriefing licenses={licenses} balance={balance} legacyStatus={legacyStatus} />
          <ReferralsWidget />
          {!licenses.some((l) => l.is_legacy) && (
            <LegacyConnectPanel defaultOpen={licenses.length === 0 && legacyStatus !== "unchecked" && legacyStatus !== "not_legacy"} />
          )}
        </div>

          </main>
        </SidebarInset>
      </div>
      <TutorialHintDialog open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </SidebarProvider>
  );
}

function TrialCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) {
    return (
      <div className="rounded border border-border/50 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        sem expiração
      </div>
    );
  }
  const exp = new Date(expiresAt).getTime();
  const diff = exp - now;
  const expired = diff <= 0;
  const abs = Math.abs(diff);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts = d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  const status = expired
    ? { label: "EXPIRADO", color: "text-danger", border: "border-danger/50", bg: "bg-danger/10", dot: "bg-danger" }
    : diff <= 60 * 60 * 1000
      ? { label: "EXPIRA EM", color: "text-danger", border: "border-danger/50", bg: "bg-danger/10", dot: "bg-danger" }
      : diff <= 6 * 60 * 60 * 1000
        ? { label: "EXPIRA EM", color: "text-amber-400", border: "border-amber-400/40", bg: "bg-amber-400/5", dot: "bg-amber-400" }
        : { label: "VÁLIDO POR", color: "text-neon", border: "border-neon/40", bg: "bg-neon/5", dot: "bg-neon" };
  return (
    <div className={`rounded border ${status.border} ${status.bg} px-3 py-2 text-right font-mono`}>
      <div className={`flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-wider ${status.color}`}>
        <span className={`pulse-dot inline-block h-1.5 w-1.5 rounded-full ${status.dot}`} />
        {expired ? `expirado há` : status.label}
      </div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${status.color}`}>{parts}</div>
      <div className="mt-0.5 text-[9px] text-muted-foreground">
        {new Date(expiresAt).toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, accent, label, value, pulse }: { icon: any; accent: "neon" | "cyan" | "violet"; label: string; value: string; pulse?: boolean }) {

  const color = accent === "neon" ? "text-neon" : accent === "cyan" ? "text-cyan" : "text-violet";
  const glow = accent === "neon" ? "hover:shadow-[0_0_24px_oklch(0.85_0.24_150/0.25)]" : accent === "cyan" ? "hover:shadow-[0_0_24px_oklch(0.78_0.18_210/0.25)]" : "hover:shadow-[0_0_24px_oklch(0.7_0.22_305/0.25)]";
  return (
    <motion.div whileHover={{ y: -3, scale: 1.01 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`terminal-card scanlines group relative overflow-hidden p-4 transition-shadow ${glow}`}>
      <div className={`absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-60 ${color}`} />
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${color}`} /> {label}
      </div>
      <div className={`mt-2 flex items-center gap-2 font-mono text-2xl font-bold ${color}`}>
        {pulse && <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-current" />}
        {value}
      </div>
    </motion.div>
  );
}


function LicenseCard({ lic, onChanged, defaultOpen = false }: { lic: License; onChanged: () => void | Promise<void>; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [show, setShow] = useState(false);
  const [showIp, setShowIp] = useState(false);
  const [busy, setBusy] = useState<null | "suspend" | "reactivate" | "disable">(null);
  const suspendFn = useServerFn(suspendMyLicense);
  const reactivateFn = useServerFn(reactivateMyLicense);
  const disableFn = useServerFn(disableMyLicense);

  const expired = lic.expires_at ? new Date(lic.expires_at) < new Date() : false;
  const status = lic.disabled_at ? { label: "DESATIVADA", color: "text-danger", dot: "bg-danger" }
    : lic.revoked ? { label: "REVOGADA", color: "text-danger", dot: "bg-danger" }
    : lic.suspended_at ? { label: "SUSPENSA", color: "text-amber-400", dot: "bg-amber-400" }
    : expired ? { label: "EXPIRADA", color: "text-danger", dot: "bg-danger" }
    : { label: "ATIVA", color: "text-neon", dot: "bg-neon" };

  const tier = lic.version_tier ?? tierFromPlanSlug(lic.plan_slug);
  const accent = tierAccent(tier);
  const accentBar = accent === "neon" ? "bg-neon" : accent === "cyan" ? "bg-cyan" : "bg-violet";

  const daysLeftLabel = (() => {
    if (!lic.expires_at || lic.disabled_at || lic.revoked) return null;
    const days = Math.ceil((new Date(lic.expires_at).getTime() - Date.now()) / 86400000);
    if (days < 0) return { text: `expirada há ${Math.abs(days)}d`, color: "text-danger" };
    const color = days <= 3 ? "text-danger" : days <= 7 ? "text-amber-400" : "text-cyan";
    return { text: days === 0 ? "expira hoje" : `${days}d restantes`, color };
  })();

  function copy(v: string, label: string) { navigator.clipboard.writeText(v); toast.success(`${label} copiado`); }

  async function run(kind: "suspend" | "reactivate" | "disable") {
    if (kind === "disable" && !confirm("Desativar em definitivo? A conta será removida do servidor e não poderá ser reativada.")) return;
    setBusy(kind);
    try {
      if (kind === "suspend") await suspendFn({ data: { licenseId: lic.id } });
      else if (kind === "reactivate") await reactivateFn({ data: { licenseId: lic.id } });
      else await disableFn({ data: { licenseId: lic.id, confirm: true } });
      toast.success(kind === "suspend" ? "Licença suspensa" : kind === "reactivate" ? "Licença reativada" : "Licença desativada");
      await onChanged();
    } catch (e: any) { toast.error(e.message || "Falha na operação"); }
    setBusy(null);
  }

  const terminal = lic.disabled_at || lic.revoked;
  return (
    <motion.div layout initial={false} className="terminal-card scanlines relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-[3px] ${accentBar}`} />
      {/* HEADER — clickable summary row */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-background/40 sm:gap-4 sm:px-5"
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border ${accent === "neon" ? "border-neon/40 bg-neon/10 text-neon" : accent === "cyan" ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-violet/40 bg-violet/10 text-violet"}`}>
          {tier === "lifetime_46" ? <Crown className="h-4 w-4" /> : tier === "monthly_457" ? <Shield className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {lic.is_trial ? (
              <span className="inline-flex items-center gap-1 rounded border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400">
                <Clock className="h-2.5 w-2.5" /> TRIAL
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded border border-neon/40 bg-neon/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-neon">
                PAGA
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold ${status.color}`}>
              <span className={`pulse-dot inline-block h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            {lic.is_legacy && <span className="rounded border border-cyan/40 bg-cyan/5 px-1.5 py-0.5 font-mono text-[9px] uppercase text-cyan">antigo</span>}
          </div>
          <div className="mt-1 flex items-center gap-2 truncate font-mono text-sm">
            <span className="truncate text-foreground">{lic.yaarsa_username}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="truncate text-muted-foreground">{tierLabel(tier)}</span>
          </div>
        </div>
        <div className="hidden shrink-0 text-right font-mono text-[10px] sm:block">
          <div className="text-muted-foreground">expira</div>
          <div className="text-foreground">{lic.expires_at ? new Date(lic.expires_at).toLocaleDateString("pt-BR") : "—"}</div>
          {daysLeftLabel && <div className={`mt-0.5 ${daysLeftLabel.color}`}>{daysLeftLabel.text}</div>}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180 text-neon" : ""}`} />
      </button>

      {/* BODY — collapsible */}
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className="border-t border-border/40 px-4 pb-5 pt-4 sm:px-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 sm:hidden">
            <div className="font-mono text-[10px] text-muted-foreground">
              expira {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString("pt-BR") : "—"}
            </div>
            {daysLeftLabel && <div className={`font-mono text-[10px] ${daysLeftLabel.color}`}>{daysLeftLabel.text}</div>}
          </div>
          <FeatureList tier={tier} />
          {!lic.is_trial && (
            <div className="mt-3 flex items-center justify-between rounded border border-border/40 bg-background/40 px-2.5 py-2 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Server className="h-3 w-3 text-cyan" />
                <span>Servidor · próx. dia 20</span>
              </div>
              <div className="text-foreground">{formatBrl(serverFeeFor(!!lic.is_legacy, lic.legacy_server_fee_brl))}<span className="text-muted-foreground">/mês</span></div>
            </div>
          )}
          <div className="mt-3 space-y-2 font-mono text-xs">
            <Field label="Usuário" value={lic.yaarsa_username} onCopy={() => copy(lic.yaarsa_username, "Usuário")} />
            <Field label="E-mail" value={lic.yaarsa_email} onCopy={() => copy(lic.yaarsa_email, "Email")} />
            <Field label="Senha" value={show ? lic.password : "•".repeat(Math.min(lic.password.length, 12))}
              onCopy={() => copy(lic.password, "Senha")}
              right={<button onClick={() => setShow(!show)} className="text-muted-foreground hover:text-neon">{show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>} />
            <Field label="Servidor" value={showIp ? lic.server_ip : "•••.•••.•••.•••"}
              onCopy={() => { if (!showIp) { toast.info("Revele o IP primeiro"); return; } copy(lic.server_ip, "IP"); }}
              right={<button onClick={() => setShowIp(!showIp)} className="text-muted-foreground hover:text-neon">{showIp ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>} />
          </div>
          {!terminal && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-3">
              <Button
                size="sm" variant="outline" className="font-mono text-xs uppercase"
                onClick={() => copy(`user: ${lic.yaarsa_username}\nemail: ${lic.yaarsa_email}\npass: ${lic.password}\nserver: ${lic.server_ip}`, "Credenciais")}
              >
                <Copy className="mr-1 h-3 w-3" /> Copiar tudo
              </Button>
              {lic.suspended_at ? (
                <Button size="sm" variant="outline" onClick={() => run("reactivate")} disabled={busy !== null} className="font-mono text-xs uppercase">
                  {busy === "reactivate" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />} Reativar
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => run("suspend")} disabled={busy !== null} className="font-mono text-xs uppercase">
                  {busy === "suspend" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Pause className="mr-1 h-3 w-3" />} Suspender
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => run("disable")} disabled={busy !== null}
                className="font-mono text-xs uppercase border-danger/40 text-danger hover:bg-danger/10">
                {busy === "disable" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <PowerOff className="mr-1 h-3 w-3" />} Desativar
              </Button>
            </div>
          )}
          {lic.suspended_at && !terminal && (
            <p className="mt-2 font-mono text-[10px] text-amber-400/80">// acesso bloqueado no servidor — reative quando quiser</p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function Field({ label, value, onCopy, right }: { label: string; value: string; onCopy: () => void; right?: React.ReactNode }) {
  return (
    <div className="group flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/60 px-3 py-3 transition-colors hover:border-neon/40 hover:bg-background/80 sm:gap-3 sm:py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 sm:text-[9px]">{label}</span>
        <span className="truncate font-mono text-sm text-foreground sm:text-[13px]">{value}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {right && <div className="inline-flex h-9 w-9 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-neon sm:h-7 sm:w-7">{right}</div>}
        <button onClick={onCopy} title="Copiar" className="inline-flex h-9 w-9 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-neon sm:h-7 sm:w-7">
          <Copy className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
      </div>
    </div>
  );
}


function TierBadge({ tier, isLegacy }: { tier: VersionTier; isLegacy: boolean }) {
  const accent = tierAccent(tier);
  const color = accent === "neon" ? "border-neon/40 text-neon bg-neon/5" : accent === "cyan" ? "border-cyan/40 text-cyan bg-cyan/5" : "border-violet/40 text-violet bg-violet/5";
  const Icon = tier === "lifetime_46" ? Crown : tier === "monthly_457" ? Shield : Sparkles;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${color}`}>
        <Icon className="h-3 w-3" /> {tierLabel(tier)}
      </span>
      {isLegacy && <span className="rounded border border-cyan/40 bg-cyan/5 px-2 py-0.5 font-mono text-[10px] uppercase text-cyan">cliente antigo</span>}
    </div>
  );
}

function FeatureList({ tier }: { tier: VersionTier }) {
  const f = getTierFeatures(tier);
  const items = [
    { ok: f.bypass_play_protect, label: "Bypass Play Protect" },
    { ok: f.free_updates, label: f.free_updates ? "Atualizações grátis" : "Atualizações pagas" },
    { ok: f.priority_support, label: "Suporte prioritário" },
    { ok: f.full_features, label: "Todas as ferramentas do bot" },
  ];
  return (
    <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-[10px]">
      {items.map((it, i) => (
        <li key={i} className={`flex items-center gap-1.5 rounded border px-2 py-1 ${it.ok ? "border-neon/25 bg-neon/5 text-foreground" : "border-border/40 bg-background/40 text-muted-foreground"}`}>
          {it.ok ? <Check className="h-3 w-3 text-neon" /> : <X className="h-3 w-3 text-muted-foreground/60" />}
          <span className="truncate">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}


function PublishedUpdatesList() {
  const listFn = useServerFn(listMyUpdates);
  const urlFn = useServerFn(getUpdateDownloadUrl);
  const [rows, setRows] = useState<Array<{ id: string; title: string; version: string; notes: string | null; filename: string; size_bytes: number | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setRows((await listFn()) as any); } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  async function download(id: string) {
    setBusy(id);
    try {
      const { url, filename } = await urlFn({ data: { id } });
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) {
      toast.error(e?.message || "Falha no download");
    } finally { setBusy(null); }
  }

  if (loading || rows.length === 0) return null;
  return (
    <div className="mt-5 border-t border-border/60 pt-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-neon">// novidades · publicadas pelo admin</div>
      <ul className="mt-2 space-y-2">
        {rows.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 rounded border border-border/60 bg-background/40 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{u.title}</span>
                <span className="rounded border border-neon/40 bg-neon/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-neon">v{u.version}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              {u.notes && <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{u.notes}</p>}
            </div>
            <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => download(u.id)} className="gap-1.5 font-mono text-[11px] uppercase">
              {busy === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Baixar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DownloadsSection({ licenses, isAdmin }: { licenses: License[]; isAdmin: boolean }) {
  const now = Date.now();
  const activeLicenses = licenses.filter((l) => {
    if (l.disabled_at || l.revoked || l.suspended_at) return false;
    if (l.expires_at && new Date(l.expires_at).getTime() < now) return false;
    return true;
  });
  const hasActive = activeLicenses.length > 0;
  const unlocked = hasActive || isAdmin;

  // Pick the highest available tier — lifetime_46 > monthly_457 > weekly.
  const tierRank: Record<VersionTier, number> = { weekly: 0, monthly_457: 1, lifetime_46: 2 };
  const bestTier: VersionTier = activeLicenses.length
    ? (activeLicenses.map((l) => l.version_tier ?? tierFromPlanSlug(l.plan_slug))
        .sort((a, b) => tierRank[b] - tierRank[a])[0] as VersionTier)
    : "lifetime_46";
  const files = downloadsForTier(bestTier);


  // Diagnose the blocking reason from the "best" license (most recent, least broken).
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
  type Reason = { code: "none" | "disabled" | "revoked" | "suspended" | "expired"; title: string; short: string; detail: string; cta: { label: string; to: string } };
  function diagnose(): Reason {
    if (licenses.length === 0) {
      return { code: "none", title: "Sem licença ativa", short: "sem licença", detail: "Você ainda não possui uma licença. Compre um plano para liberar os downloads.", cta: { label: "Ver planos", to: "/planos" } };
    }
    // Priority: suspended (recoverable) > expired > disabled > revoked
    const sorted = [...licenses].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const suspended = sorted.find((l) => l.suspended_at && !l.disabled_at && !l.revoked);
    if (suspended) return {
      code: "suspended", title: "Licença suspensa", short: "suspensa",
      detail: `Suspensa em ${fmt(suspended.suspended_at)}. Reative no card da licença acima para liberar novamente — o desbloqueio é imediato.`,
      cta: { label: "Ir para licenças", to: "#" },
    };
    const expired = sorted.find((l) => !l.disabled_at && !l.revoked && l.expires_at && new Date(l.expires_at).getTime() < now);
    if (expired) return {
      code: "expired", title: "Licença expirada", short: "expirada",
      detail: `Expirou em ${fmt(expired.expires_at)}. Renove o plano — os downloads liberam assim que o pagamento é aprovado (geralmente < 1 min).`,
      cta: { label: "Renovar plano", to: "/planos" },
    };
    const disabled = sorted.find((l) => l.disabled_at);
    if (disabled) return {
      code: "disabled", title: "Licença desativada", short: "desativada",
      detail: `Desativada em ${fmt(disabled.disabled_at)} — a conta foi removida do servidor e não pode ser reativada. Compre um novo plano para receber credenciais e liberar os arquivos.`,
      cta: { label: "Ver planos", to: "/planos" },
    };
    const revoked = sorted.find((l) => l.revoked);
    if (revoked) return {
      code: "revoked", title: "Licença revogada", short: "revogada",
      detail: "Sua licença foi revogada pelo admin. Fale com o suporte ou compre um novo plano.",
      cta: { label: "Falar com suporte", to: "/suporte" },
    };
    return { code: "none", title: "Sem licença ativa", short: "sem licença", detail: "Nenhuma licença ativa encontrada.", cta: { label: "Ver planos", to: "/planos" } };
  }

  return (
    <div id="downloads" className="mt-8 terminal-card rgb-border scanlines relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet to-transparent" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-violet/40 bg-violet/10 text-violet">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-xl leading-tight">Downloads</h3>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">// shadow client · arquivos oficiais</div>
          </div>
        </div>
        {unlocked && (
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
            liberados para <span className="text-neon">{tierLabel(bestTier)}</span>
          </span>
        )}
      </div>
      {unlocked ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Shadow client — senha do arquivo: <span className="font-mono text-neon">@kremlinbrd</span></p>
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((f) => (
              <a key={f.url} href={f.url} target="_blank" rel="noreferrer">
                <Button variant="outline" className={f.latest ? "border-neon/40 font-mono uppercase text-neon hover:bg-neon/10" : "font-mono uppercase"}>
                  {f.label}{f.note ? ` · ${f.note}` : ""}
                </Button>
              </a>
            ))}
          </div>
          <PublishedUpdatesList />
          {bestTier !== "lifetime_46" && (
            <p className="mt-3 font-mono text-[10px] text-muted-foreground">
              // upgrade para <span className="text-violet">Vitalício 4.6</span> libera atualizações grátis + suporte prioritário.
            </p>
          )}
        </>
      ) : (() => {
        const r = diagnose();
        const accent = r.code === "suspended" ? "text-amber-400" : r.code === "expired" ? "text-amber-400" : "text-danger";
        return (
          <>
            <div className={`mt-2 flex items-center gap-2 font-mono text-xs uppercase ${accent}`}>
              <ShieldAlert className="h-4 w-4" /> {r.title}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{r.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((f) => (
                <Button
                  key={f.url}
                  variant="outline"
                  disabled
                  title={r.detail}
                  className="font-mono uppercase opacity-60 cursor-not-allowed"
                >
                  {f.label} • {r.short}
                </Button>
              ))}
              {r.cta.to === "#"
                ? null
                : <Link to={r.cta.to}><Button className="font-mono uppercase tracking-wider">{r.cta.label}</Button></Link>}
            </div>
          </>
        );
      })()}
    </div>
  );
}


// ============ BusinessBriefing ============
// Executive briefing strip: business-oriented KPIs + marketing CTAs
// (uptime SLA, protected days, lifetime savings, referral revenue potential).
function BusinessBriefing({
  licenses, balance, legacyStatus,
}: { licenses: License[]; balance: number; legacyStatus: string }) {
  const active = licenses.filter((l) => !l.revoked && !l.disabled_at && !l.suspended_at && (!l.expires_at || new Date(l.expires_at) > new Date()));
  const hasLifetime = active.some((l) => l.plan_slug === "login-lifetime");
  const protectedDays = active.reduce((acc, l) => {
    if (l.plan_slug === "login-lifetime") return acc + 365 * 5;
    if (!l.expires_at) return acc;
    return acc + Math.max(0, Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000));
  }, 0);
  const referralsPotential = 3 * 150; // 3 indicações padrão

  return (
    <div className="mb-6 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background to-background p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// briefing executivo</div>
          <h3 className="mt-0.5 font-display text-lg font-semibold">Sua operação em números</h3>
        </div>
        <Link to="/indicacoes" className="hidden sm:block">
          <Button size="sm" variant="outline" className="font-mono text-xs uppercase tracking-wider">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ganhar R$ 150
          </Button>
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BriefingKPI label="SLA de uptime" value="99.9%" hint="monitorado 24/7" tone="ok" />
        <BriefingKPI label="Dias protegidos" value={hasLifetime ? "∞" : String(protectedDays)} hint={hasLifetime ? "acesso vitalício" : "somando licenças ativas"} tone="brand" />
        <BriefingKPI label="Cashback disponível" value={formatBrl(balance)} hint="use no próximo checkout" tone={balance > 0 ? "brand" : "muted"} />
        <BriefingKPI label="Potencial indicações" value={formatBrl(referralsPotential)} hint="3 amigos · R$ 150 cada" tone="ok" />
      </div>

      {/* Marketing strip — muda de acordo com o perfil do cliente */}
      {!hasLifetime && legacyStatus !== "v457" && (
        <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-md border border-primary/25 bg-primary/[0.06] p-3 md:flex-row md:items-center">
          <div className="flex items-start gap-2.5">
            <Crown className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="text-xs">
              <div className="font-mono uppercase tracking-wider text-primary">upgrade vitalício</div>
              <div className="mt-0.5 text-muted-foreground">
                Pague uma vez e pare de renovar. Economia média de <span className="font-semibold text-foreground">R$ 6.240/ano</span> vs mensal + prioridade no suporte.
              </div>
            </div>
          </div>
          <Link to="/planos" className="md:shrink-0">
            <Button size="sm" className="font-mono text-xs uppercase tracking-wider">Ver oferta</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function BriefingKPI({ label, value, hint, tone = "muted" }: { label: string; value: string; hint: string; tone?: "ok" | "brand" | "muted" }) {
  const toneCls =
    tone === "ok" ? "text-emerald-300" :
    tone === "brand" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-background/60 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold leading-none ${toneCls}`}>{value}</div>
      <div className="mt-1 font-mono text-[10px] text-muted-foreground/80">{hint}</div>
    </div>
  );
}






// ============ ExpiryAlerts ============
// Shows a stacked banner at the top of the dashboard for every license that
// is close to expiring (license itself, or the monthly server renewal).
// Legacy clients get a direct CTA to the R$ 250 renewal plan; regular clients
// go to /planos to pick the R$ 450 monthly server plan.
type LicenseLite = {
  id: string;
  plan_slug: string;
  expires_at: string | null;
  server_paid_until: string | null;
  server_overdue_at?: string | null;
  revoked?: boolean;
  disabled_at?: string | null;
  is_legacy?: boolean | null;
  is_trial?: boolean | null;
};

function ExpiryAlerts({ licenses }: { licenses: LicenseLite[] }) {
  type Kind = "srv-blocked" | "srv-soon" | "lic-soon";
  type Alert = { kind: Kind; sev: Exclude<ExpirySeverity, null>; title: string; body: string; cta?: { to: string; label: string }; count: number };
  const map = new Map<Kind, Alert>();
  const push = (a: Omit<Alert, "count">) => {
    const prev = map.get(a.kind);
    if (!prev) { map.set(a.kind, { ...a, count: 1 }); return; }
    // Keep the most severe/soonest variant, bump the count.
    prev.count += 1;
    if (a.sev === "critical") { prev.sev = "critical"; prev.title = a.title; prev.body = a.body; prev.cta = a.cta; }
  };

  let anyLegacy = false;
  for (const l of licenses) {
    if (l.disabled_at) continue;
    if (l.is_legacy) anyLegacy = true;
    if (!l.is_trial) {
      const dServer = daysUntil(l.server_paid_until);
      const sevServer = severityFromDays(dServer);
      if (l.revoked || l.server_overdue_at) {
        push({
          kind: "srv-blocked", sev: "critical",
          title: "Servidor bloqueado por falta de pagamento",
          body: "A mensalidade do servidor (dia 20) não foi paga. Login suspenso até renovar.",
          cta: { to: l.is_legacy ? "/renovar-servidor" : "/planos", label: l.is_legacy ? "Renovar por R$ 250" : "Renovar por R$ 450" },

        });
      } else if (sevServer) {
        push({
          kind: "srv-soon", sev: sevServer,
          title: sevServer === "critical" ? "Servidor vence em breve" : "Servidor perto de vencer",
          body: `Mensalidade do servidor vence ${dServer !== null && dServer <= 0 ? "hoje" : `em ${dServer} dia(s)`}. Renove antes do dia 20 para não perder o acesso.`,
          cta: { to: l.is_legacy ? "/renovar-servidor" : "/planos", label: l.is_legacy ? "Renovar por R$ 250" : "Renovar por R$ 450" },
        });
      }
    }

    const dLic = daysUntil(l.expires_at);
    const sevLic = severityFromDays(dLic);
    if (sevLic && l.plan_slug !== "login-lifetime") {
      push({
        kind: "lic-soon", sev: sevLic,
        title: sevLic === "critical" ? "Licença vence em breve" : "Licença perto de vencer",
        body: `Sua licença expira ${dLic !== null && dLic <= 0 ? "hoje" : `em ${dLic} dia(s)`}. Renove para manter o acesso à ferramenta.`,
        cta: { to: "/planos", label: "Ver planos" },
      });
    }
  }

  const alerts = Array.from(map.values()).sort((a, b) => (a.sev === "critical" ? -1 : 1) - (b.sev === "critical" ? -1 : 1));
  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {alerts.map((a) => {
        const c = severityColor(a.sev);
        const suffix = a.count > 1 ? ` · ${a.count} licenças` : "";
        return (
          <div key={a.kind} className={`terminal-card scanlines relative flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between ${c.border} ${c.bg}`}>
            <div className="flex items-start gap-3">
              {a.sev === "critical"
                ? <AlertTriangle className={`h-5 w-5 shrink-0 ${c.text}`} />
                : <BellRing className={`h-5 w-5 shrink-0 ${c.text}`} />}
              <div>
                <div className={`font-mono text-xs uppercase tracking-wider ${c.text}`}>{a.title}{suffix}</div>
                <div className="mt-1 text-sm text-muted-foreground">{a.body}</div>
              </div>
            </div>
            {a.cta && (
              <Link to={a.cta.to} className="md:shrink-0">
                <Button className="font-mono uppercase tracking-wider">{a.cta.label}</Button>
              </Link>
            )}
          </div>
        );
      })}
      {anyLegacy && (
        <div className="font-mono text-[10px] text-muted-foreground/70">// cliente antigo: mensalidade do servidor R$ 250 (todo dia 20)</div>
      )}
    </div>
  );
}

