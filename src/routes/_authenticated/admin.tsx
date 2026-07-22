import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users, DollarSign, KeyRound, Ban, Calendar, RefreshCw, RotateCw,
  ShieldCheck, LifeBuoy, MessageSquare, Send, Loader2, Search,
  BarChart3, Activity, Zap, LogOut, Circle, ScrollText, Download,
  UserPlus, Sparkles, History, ShieldAlert, Gift, Check, Bell, BellOff, Store, Package,
  Wallet,
} from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { LicenseAiPanel } from "@/components/LicenseAiPanel";
import { AdminAlertsBanner } from "@/components/AdminAlertsBanner";
import { AdminApkPanel } from "@/components/AdminApkPanel";
import { AdminMarketPanel } from "@/components/AdminMarketPanel";
import { AdminUpdatesPanel } from "@/components/AdminUpdatesPanel";
import { AdminExternalPayersPanel } from "@/components/AdminExternalPayersPanel";





import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl, tierLabel, type VersionTier } from "@/lib/plans";
import {
  adminStats, adminListUsers, adminListOrders, adminListLicenses,
  adminRevokeLicense, adminExtendLicense,
  adminSetRole, adminListRoles, adminRenewClientServer, adminRecreateLicense,
  adminListThreads, adminListThreadMessages, adminSendMessage, adminListLogs,
  adminAssumeThread, adminCloseThread,
  adminCreateLicenseForClient, adminRegisterLegacyLicense,
  adminListReferrals, adminMarkReferralPaid,
} from "@/lib/admin.functions";
import { playNotifyDing, unlockNotifySound, requestNotifyPermission, showDesktopNotification } from "@/lib/notify-sound";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Shadow" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!role) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

type Tab = "overview" | "ia" | "chat" | "issue" | "legacy" | "external" | "users" | "orders" | "licenses" | "referrals" | "staff" | "logs" | "audit" | "apk" | "market" | "updates";


function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<{ users: number; licenses: number; revenue: number } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [email, setEmail] = useState("");
  const [licKind, setLicKind] = useState<"all" | "trial" | "paid">("all");
  const [licStatus, setLicStatus] = useState<"all" | "active" | "expiring" | "expired" | "revoked">("all");
  const [licView, setLicView] = useState<"table" | "grouped">("table");
  const [licSearch, setLicSearch] = useState("");


  const statsFn = useServerFn(adminStats);
  const usersFn = useServerFn(adminListUsers);
  const ordersFn = useServerFn(adminListOrders);
  const licensesFn = useServerFn(adminListLicenses);
  const revokeFn = useServerFn(adminRevokeLicense);
  const extendFn = useServerFn(adminExtendLicense);
  const rolesFn = useServerFn(adminListRoles);
  const setRoleFn = useServerFn(adminSetRole);
  const renewFn = useServerFn(adminRenewClientServer);
  const recreateFn = useServerFn(adminRecreateLicense);

  // Track which lists have been loaded so realtime/polling don't refetch
  // datasets the admin never opened. Cuts admin cold-load from 5 parallel
  // fetches down to just stats+orders (used by the default Overview tab).
  const loadedRef = useRef<{ users: boolean; orders: boolean; licenses: boolean; roles: boolean }>({
    users: false, orders: false, licenses: false, roles: false,
  });
  const inflightRef = useRef<{ [K in "stats" | "users" | "orders" | "licenses" | "roles"]?: Promise<any> }>({});

  const loadStats = useCallback(() => {
    if (inflightRef.current.stats) return inflightRef.current.stats;
    const p = statsFn().then((r) => { setStats(r); return r; }).catch(() => {}).finally(() => { inflightRef.current.stats = undefined; });
    inflightRef.current.stats = p;
    return p;
  }, [statsFn]);
  const loadOrders = useCallback(() => {
    if (inflightRef.current.orders) return inflightRef.current.orders;
    const p = ordersFn().then((r) => { setOrders(r); loadedRef.current.orders = true; return r; }).catch(() => {}).finally(() => { inflightRef.current.orders = undefined; });
    inflightRef.current.orders = p;
    return p;
  }, [ordersFn]);
  const loadUsers = useCallback(() => {
    if (inflightRef.current.users) return inflightRef.current.users;
    const p = usersFn().then((r) => { setUsers(r); loadedRef.current.users = true; return r; }).catch(() => {}).finally(() => { inflightRef.current.users = undefined; });
    inflightRef.current.users = p;
    return p;
  }, [usersFn]);
  const loadLicenses = useCallback(() => {
    if (inflightRef.current.licenses) return inflightRef.current.licenses;
    const p = licensesFn().then((r) => { setLicenses(r); loadedRef.current.licenses = true; return r; }).catch(() => {}).finally(() => { inflightRef.current.licenses = undefined; });
    inflightRef.current.licenses = p;
    return p;
  }, [licensesFn]);
  const loadRoles = useCallback(() => {
    if (inflightRef.current.roles) return inflightRef.current.roles;
    const p = rolesFn().then((r) => { setRoles(r as any); loadedRef.current.roles = true; return r; }).catch(() => {}).finally(() => { inflightRef.current.roles = undefined; });
    inflightRef.current.roles = p;
    return p;
  }, [rolesFn]);

  // Bootstrap: Overview needs stats + orders + licenças (para alertas de expiração).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    loadStats();
    loadOrders();
    loadLicenses();

    // Debounced realtime → só refresca listas já carregadas.
    let t: any;
    const debounce = (fn: () => void) => { clearTimeout(t); t = setTimeout(fn, 500); };
    let statsCooldown = 0;
    const refreshStatsThrottled = () => {
      const now = Date.now();
      if (now - statsCooldown < 15000) return;
      statsCooldown = now;
      loadStats();
    };

    const ch = supabase.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "licenses" },
        () => debounce(() => { if (loadedRef.current.licenses) loadLicenses(); refreshStatsThrottled(); }))
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" },
        () => debounce(() => { if (loadedRef.current.orders) loadOrders(); refreshStatsThrottled(); }))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" },
        () => debounce(() => { if (loadedRef.current.users) loadUsers(); refreshStatsThrottled(); }))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" },
        () => debounce(() => { if (loadedRef.current.roles) loadRoles(); }))
      .subscribe();

    const poll = setInterval(() => {
      loadStats();
      if (loadedRef.current.orders) loadOrders();
      if (loadedRef.current.licenses) loadLicenses();
      if (loadedRef.current.users) loadUsers();
      if (loadedRef.current.roles) loadRoles();
    }, 90000);

    return () => { clearInterval(poll); clearTimeout(t); supabase.removeChannel(ch); };
  }, [loadStats, loadOrders, loadUsers, loadLicenses, loadRoles]);

  // Lazy-load para as outras abas.
  useEffect(() => {
    if (tab === "users" || tab === "staff" || tab === "audit") { loadUsers(); if (tab === "staff") loadRoles(); }
    if (tab === "orders") loadOrders();
    if (tab === "licenses" || tab === "legacy" || tab === "audit" || tab === "issue") loadLicenses();
  }, [tab, loadUsers, loadRoles, loadOrders, loadLicenses]);


  async function revoke(id: string) {
    if (!confirm("Revogar esta licença?")) return;
    try { await revokeFn({ data: { licenseId: id } }); toast.success("Revogada"); setLicenses(await licensesFn()); }
    catch (e: any) { toast.error(e.message); }
  }
  async function extend(id: string) {
    const d = prompt("Nova data (YYYY-MM-DD)"); if (!d) return;
    try { await extendFn({ data: { licenseId: id, newExpireDate: d } }); toast.success("Estendida"); setLicenses(await licensesFn()); }
    catch (e: any) { toast.error(e.message); }
  }
  async function renew(id: string) {
    if (!confirm("Renovar servidor deste cliente até o próximo dia 20?")) return;
    try { await renewFn({ data: { licenseId: id } }); toast.success("Servidor renovado"); setLicenses(await licensesFn()); }
    catch (e: any) { toast.error(e.message); }
  }
  async function recreate(id: string) {
    if (!confirm("Recriar credenciais do login? A senha anterior será substituída.")) return;
    try {
      const r: any = await recreateFn({ data: { licenseId: id } });
      toast.success(`Nova credencial: ${r.credentials.username} / ${r.credentials.password}`, { duration: 20000 });
      setLicenses(await licensesFn());
    } catch (e: any) { toast.error(e.message); }
  }
  async function setRole(userId: string, role: "admin" | "moderator" | "user") {
    try { await setRoleFn({ data: { userId, role } }); toast.success("Cargo atualizado"); setRoles(await rolesFn() as any); }
    catch (e: any) { toast.error(e.message); }
  }

  const tabGroups: { title: string; accent: "neon" | "cyan" | "violet"; items: { id: Tab; label: string; icon: any; hint?: string }[] }[] = [
    {
      title: "Operações", accent: "neon", items: [
        { id: "overview", label: "Visão Geral", icon: BarChart3, hint: "resumo executivo" },
        { id: "ia", label: "Shadow Ops IA", icon: Sparkles, hint: "diagnóstico automático" },
        { id: "chat", label: "Chat ao Vivo", icon: MessageSquare, hint: "responder clientes" },
        { id: "apk", label: "Fila Play Protect", icon: Download, hint: "APKs pendentes" },
        { id: "updates", label: "Publicar Update", icon: Package, hint: "novos arquivos" },
      ],
    },
    {
      title: "Clientes & Licenças", accent: "cyan", items: [
        { id: "issue", label: "Emitir Licença", icon: UserPlus, hint: "criar login manual" },
        { id: "legacy", label: "Clientes Antigos", icon: History, hint: "R$ 250 servidor" },
        { id: "external", label: "Pagam Por Fora", icon: Wallet, hint: "extensão manual" },
        { id: "users", label: "Usuários", icon: Users },
        { id: "licenses", label: "Licenças", icon: KeyRound },
      ],
    },
    {
      title: "Financeiro", accent: "violet", items: [
        { id: "orders", label: "Pedidos", icon: DollarSign },
        { id: "market", label: "Mercado", icon: Store, hint: "produtos & catálogo" },
        { id: "referrals", label: "Indicações", icon: Gift, hint: "cashback / pix" },
      ],
    },
    {
      title: "Sistema", accent: "cyan", items: [
        { id: "staff", label: "Equipe", icon: ShieldCheck },
        { id: "logs", label: "Logs do servidor", icon: ScrollText },
        { id: "audit", label: "Auditoria", icon: ShieldAlert },
      ],
    },
  ];
  const allTabs = tabGroups.flatMap((g) => g.items);
  const activeMeta = allTabs.find((t) => t.id === tab);


  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        {/* HEADER BAR */}
        <div className="terminal-card scanlines relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-neon/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.35em] text-violet">
                <ShieldCheck className="h-3.5 w-3.5" /> admin control center
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Painel Administrativo</h1>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                sessão · <span className="text-foreground/70">{email}</span> · {new Date().toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border border-neon/30 bg-neon/5 px-3 py-1.5 font-mono text-[10px] uppercase text-neon md:inline-flex">
                <Circle className="h-2 w-2 fill-neon text-neon" /> sistemas online
              </div>
              <Link to="/dashboard"><Button size="sm" variant="outline" className="font-mono uppercase tracking-wider">Meu Painel</Button></Link>
              <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()} className="font-mono uppercase tracking-wider">
                <LogOut className="mr-2 h-3.5 w-3.5" /> Sair
              </Button>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <ExecStat icon={Users} label="Clientes cadastrados" value={stats ? String(stats.users) : "—"} sub="conta total" accent="cyan" />
          <ExecStat icon={KeyRound} label="Licenças ativas" value={stats ? String(stats.licenses) : "—"} sub="em operação" accent="neon" />
          <ExecStat icon={DollarSign} label="Receita bruta" value={stats ? formatBrl(stats.revenue) : "—"} sub="pedidos pagos" accent="violet" />
          <ExecStat icon={Activity} label="Servidor" value="ONLINE" sub="uptime 99.9%" accent="neon" pulse />
        </div>

        {/* GROUPED LAYOUT: sidebar (desktop) + content */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* SIDEBAR NAV */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            {/* Mobile: horizontal scroller */}
            <div className="lg:hidden -mx-4 overflow-x-auto px-4 pb-2">
              <div className="flex gap-1.5 whitespace-nowrap">
                {allTabs.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                        active
                          ? "border-neon/50 bg-neon/10 text-neon"
                          : "border-border/50 bg-background/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      <t.icon className="h-3 w-3" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Desktop: grouped vertical nav */}
            <nav className="hidden lg:block terminal-card scanlines relative p-3">
              {tabGroups.map((g, gi) => {
                const accentColor = g.accent === "neon" ? "text-neon" : g.accent === "cyan" ? "text-cyan" : "text-violet";
                return (
                  <div key={g.title} className={gi > 0 ? "mt-4 border-t border-border/40 pt-4" : ""}>
                    <div className={`px-2 pb-2 font-mono text-[9px] uppercase tracking-[0.25em] ${accentColor}`}>
                      // {g.title}
                    </div>
                    <div className="space-y-0.5">
                      {g.items.map((t) => {
                        const active = tab === t.id;
                        const isNew = t.id === "external";
                        return (
                          <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`group flex w-full items-center gap-2 rounded px-2 py-2 text-left transition-colors ${
                              active
                                ? "bg-neon/10 text-neon"
                                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                            }`}
                          >
                            <t.icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-neon" : "text-muted-foreground group-hover:text-foreground"}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <div className="truncate font-mono text-[11px] uppercase tracking-wider">{t.label}</div>
                                {isNew && !active && <span className="rounded bg-violet/20 px-1 py-px font-mono text-[8px] uppercase tracking-wider text-violet">novo</span>}
                              </div>
                              {t.hint && <div className="truncate text-[9px] text-muted-foreground/70">{t.hint}</div>}
                            </div>
                            {active && <span className="h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_8px_var(--neon)]" />}
                          </button>
                        );
                      })}
                    </div>

                  </div>
                );
              })}
              <div className="mt-4 border-t border-border/40 pt-3">
                <Link to="/suporte" className="flex items-center gap-2 rounded px-2 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/5">
                  <LifeBuoy className="h-3.5 w-3.5" /> Ver Suporte
                </Link>
              </div>
            </nav>
          </aside>

          {/* CONTENT */}
          <div className="min-w-0">
            <AdminAlertsBanner onOpenLogs={() => setTab("logs")} onOpenIA={() => setTab("ia")} />

            {/* Section title bar */}
            {activeMeta && (
              <div className="mb-4 flex items-center gap-2 border-b border-border/40 pb-3">
                <activeMeta.icon className="h-4 w-4 text-neon" />
                <h2 className="font-mono text-sm uppercase tracking-wider text-foreground">{activeMeta.label}</h2>
                {activeMeta.hint && <span className="ml-2 font-mono text-[10px] text-muted-foreground">// {activeMeta.hint}</span>}
              </div>
            )}


          {tab === "overview" && (() => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const ordersToday = orders.filter((o) => new Date(o.created_at) >= today);
            const paidToday = ordersToday.filter((o) => o.status === "paid");
            const revenueToday = paidToday.reduce((s, o) => s + Number(o.amount || 0), 0);
            const pendingCount = orders.filter((o) => o.status !== "paid" && o.status !== "failed" && o.status !== "cancelled").length;
            const expSoon = licenses
              .filter((l) => !l.is_trial && !l.disabled_at && !l.revoked && l.expires_at)
              .map((l) => ({ l, days: Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000) }))
              .filter((x) => x.days <= 5)
              .sort((a, b) => a.days - b.days)
              .slice(0, 6);
            const trialsActive = licenses.filter((l) => l.is_trial && !l.disabled_at && !l.revoked && (!l.expires_at || new Date(l.expires_at) > new Date())).length;
            return (
              <div className="space-y-4">
                {/* Mini strip: HOJE */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MiniStat label="Pedidos hoje" value={String(ordersToday.length)} accent="cyan" />
                  <MiniStat label="Pagos hoje" value={String(paidToday.length)} accent="neon" />
                  <MiniStat label="Receita hoje" value={formatBrl(revenueToday)} accent="violet" />
                  <MiniStat label="Trials ativos" value={String(trialsActive)} accent="cyan" />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {/* Pedidos recentes */}
                  <div className="terminal-card scanlines relative p-5 md:col-span-2">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-mono text-xs uppercase tracking-wider text-cyan">// pedidos recentes</h3>
                      <button onClick={() => setTab("orders")} className="font-mono text-[10px] uppercase text-muted-foreground hover:text-neon">ver todos →</button>
                    </div>
                    <div className="space-y-2">
                      {orders.slice(0, 8).map((o) => (
                        <div key={o.id} className="flex items-center justify-between gap-2 rounded border border-border/40 bg-background/40 px-3 py-2 font-mono text-xs">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${o.status === "paid" ? "bg-neon" : o.status === "failed" || o.status === "cancelled" ? "bg-danger" : "bg-amber-400"}`} />
                            <span className="uppercase text-foreground/80">{o.plan_slug}</span>
                            {o.profile?.email && <span className="truncate text-muted-foreground">· {o.profile.email}</span>}
                            {o.coupon_code && <span className="shrink-0 rounded bg-violet/10 px-1.5 py-0.5 text-[9px] text-violet">{o.coupon_code}</span>}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="text-foreground">{formatBrl(Number(o.amount))}</span>
                            <span className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                      ))}
                      {orders.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">nenhum pedido ainda</div>}
                    </div>
                  </div>

                  {/* Atalhos */}
                  <div className="terminal-card scanlines relative p-5">
                    <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-violet">// atalhos</h3>
                    <div className="space-y-2">
                      <button onClick={() => setTab("chat")} className="flex w-full items-center gap-3 rounded border border-border/40 bg-background/40 p-3 text-left transition-colors hover:border-neon/40 hover:bg-neon/5">
                        <MessageSquare className="h-4 w-4 shrink-0 text-neon" />
                        <div className="min-w-0"><div className="font-mono text-xs uppercase">Chat ao vivo</div><div className="text-[10px] text-muted-foreground">Responder clientes</div></div>
                      </button>
                      <button onClick={() => setTab("issue")} className="flex w-full items-center gap-3 rounded border border-border/40 bg-background/40 p-3 text-left transition-colors hover:border-neon/40 hover:bg-neon/5">
                        <UserPlus className="h-4 w-4 shrink-0 text-neon" />
                        <div className="min-w-0"><div className="font-mono text-xs uppercase">Emitir licença</div><div className="text-[10px] text-muted-foreground">Criar login manual</div></div>
                      </button>
                      <button onClick={() => setTab("external")} className="flex w-full items-center gap-3 rounded border border-violet/40 bg-violet/5 p-3 text-left transition-colors hover:border-violet/60 hover:bg-violet/10">
                        <Wallet className="h-4 w-4 shrink-0 text-violet" />
                        <div className="min-w-0"><div className="font-mono text-xs uppercase">Pagam por fora</div><div className="text-[10px] text-muted-foreground">Migrar clientes antigos</div></div>
                      </button>
                      <button onClick={() => setTab("apk")} className="flex w-full items-center gap-3 rounded border border-border/40 bg-background/40 p-3 text-left transition-colors hover:border-cyan/40 hover:bg-cyan/5">
                        <Download className="h-4 w-4 shrink-0 text-cyan" />
                        <div className="min-w-0"><div className="font-mono text-xs uppercase">Fila Play Protect</div><div className="text-[10px] text-muted-foreground">APKs pendentes</div></div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Painel de atenção: expirando + pendentes */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="terminal-card scanlines relative p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-amber-400"><Bell className="h-3.5 w-3.5" /> licenças expirando (≤5d)</h3>
                      <button onClick={() => setTab("licenses")} className="font-mono text-[10px] uppercase text-muted-foreground hover:text-neon">gerir →</button>
                    </div>
                    {expSoon.length === 0 ? (
                      <div className="rounded border border-dashed border-border/40 bg-background/30 py-6 text-center text-xs text-muted-foreground">tudo certinho ✓</div>
                    ) : (
                      <div className="space-y-1.5">
                        {expSoon.map(({ l, days }) => (
                          <div key={l.id} className="flex items-center justify-between rounded border border-border/40 bg-background/40 px-3 py-2 font-mono text-xs">
                            <div className="min-w-0 truncate">
                              <span className="text-foreground/80">{l.yaarsa_username}</span>
                              <span className="text-muted-foreground"> · {l.yaarsa_email}</span>
                            </div>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ${days <= 2 ? "bg-danger/15 text-danger" : "bg-amber-400/15 text-amber-400"}`}>
                              {days <= 0 ? "vencida" : `${days}d`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="terminal-card scanlines relative p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-cyan"><Activity className="h-3.5 w-3.5" /> pagamentos pendentes</h3>
                      <span className="rounded bg-cyan/10 px-2 py-0.5 font-mono text-[10px] uppercase text-cyan">{pendingCount}</span>
                    </div>
                    {pendingCount === 0 ? (
                      <div className="rounded border border-dashed border-border/40 bg-background/30 py-6 text-center text-xs text-muted-foreground">nenhum aguardando</div>
                    ) : (
                      <div className="space-y-1.5">
                        {orders.filter((o) => o.status !== "paid" && o.status !== "failed" && o.status !== "cancelled").slice(0, 6).map((o) => (
                          <div key={o.id} className="flex items-center justify-between rounded border border-border/40 bg-background/40 px-3 py-2 font-mono text-xs">
                            <div className="min-w-0 truncate">
                              <span className="text-foreground/80">{o.plan_slug}</span>
                              {o.profile?.email && <span className="text-muted-foreground"> · {o.profile.email}</span>}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-foreground">{formatBrl(Number(o.amount))}</span>
                              <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] uppercase text-amber-400">{o.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}


          {tab === "chat" && <AdminChatPanel />}
          {tab === "issue" && <IssueLicensePanel onIssued={() => licensesFn().then(setLicenses).catch(() => {})} />}
          {tab === "legacy" && <LegacyClientsPanel licenses={licenses} onChanged={() => licensesFn().then(setLicenses).catch(() => {})} />}
          {tab === "external" && <AdminExternalPayersPanel />}

          {tab === "users" && (
            <div className="terminal-card scanlines relative overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-border/40 font-mono text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Email</th><th className="p-3 text-left">Nome</th><th className="p-3 text-left whitespace-nowrap">Criado</th></tr></thead>
                  <tbody>{users.map((u) => <tr key={u.id} className="border-b border-border/20 hover:bg-neon/5"><td className="p-3 break-all">{u.email}</td><td className="p-3 text-muted-foreground">{u.full_name || "—"}</td><td className="p-3 font-mono text-xs whitespace-nowrap">{new Date(u.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "orders" && (
            <div className="terminal-card scanlines relative overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="border-b border-border/40 font-mono text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Plano</th><th className="p-3 text-left">Valor</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Cupom</th><th className="p-3 text-left whitespace-nowrap">Data</th></tr></thead>
                  <tbody>{orders.map((o) => <tr key={o.id} className="border-b border-border/20 hover:bg-neon/5"><td className="p-3 font-mono text-xs whitespace-nowrap">{o.plan_slug}</td><td className="p-3 font-mono whitespace-nowrap">{formatBrl(Number(o.amount))}</td><td className={`p-3 font-mono text-xs uppercase ${o.status === "paid" ? "text-neon" : "text-muted-foreground"}`}>{o.status}</td><td className="p-3 font-mono text-xs">{o.coupon_code || "—"}</td><td className="p-3 font-mono text-xs whitespace-nowrap">{new Date(o.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "licenses" && (() => {
            const now = Date.now();
            const dayMs = 86400000;
            const bucketOf = (l: any): { key: string; label: string; order: number; tone: string } => {
              if (l.revoked) return { key: "revoked", label: "Revogadas", order: 99, tone: "text-danger" };
              if (!l.expires_at) return { key: "lifetime", label: "Vitalícia / sem vencimento", order: 90, tone: "text-violet" };
              const diff = Math.floor((new Date(l.expires_at).getTime() - now) / dayMs);
              if (diff < 0) return { key: "expired", label: "Vencidas", order: 0, tone: "text-danger" };
              if (diff <= 2) return { key: "d2", label: "Vence em até 2 dias", order: 1, tone: "text-red-400" };
              if (diff <= 5) return { key: "d5", label: "Vence em 3–5 dias", order: 2, tone: "text-amber-400" };
              if (diff <= 15) return { key: "d15", label: "Vence em 6–15 dias", order: 3, tone: "text-cyan" };
              if (diff <= 30) return { key: "d30", label: "Vence em 16–30 dias", order: 4, tone: "text-neon" };
              return { key: "d30plus", label: "Vence em mais de 30 dias", order: 5, tone: "text-muted-foreground" };
            };
            const statusOf = (l: any): "active" | "expiring" | "expired" | "revoked" => {
              if (l.revoked) return "revoked";
              if (!l.expires_at) return "active";
              const diff = new Date(l.expires_at).getTime() - now;
              if (diff < 0) return "expired";
              if (diff <= 5 * dayMs) return "expiring";
              return "active";
            };
            const q = licSearch.trim().toLowerCase();
            const trialsCount = licenses.filter((l) => l.is_trial).length;
            const paidCount = licenses.length - trialsCount;
            const filtered = licenses.filter((l) => {
              if (licKind === "trial" && !l.is_trial) return false;
              if (licKind === "paid" && l.is_trial) return false;
              if (licStatus !== "all" && statusOf(l) !== licStatus) return false;
              if (q) {
                const hay = `${l.yaarsa_username ?? ""} ${l.yaarsa_email ?? ""} ${l.profile?.email ?? ""} ${l.profile?.full_name ?? ""} ${l.plan_slug ?? ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
              }
              return true;
            });
            const statusPill = (l: any) => {
              const s = statusOf(l);
              if (s === "revoked") return <span className="inline-flex rounded border border-danger/50 bg-danger/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-danger">revogada</span>;
              if (s === "expired") return <span className="inline-flex rounded border border-danger/50 bg-danger/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-danger">vencida</span>;
              if (s === "expiring") return <span className="inline-flex rounded border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400">expirando</span>;
              return <span className="inline-flex rounded border border-neon/40 bg-neon/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-neon">ativa</span>;
            };
            const expiresCell = (l: any) => {
              if (!l.expires_at) return <span className="text-muted-foreground">vitalícia</span>;
              const d = new Date(l.expires_at);
              const diff = Math.floor((d.getTime() - now) / dayMs);
              const tone = diff < 0 ? "text-danger" : diff <= 2 ? "text-red-400" : diff <= 5 ? "text-amber-400" : diff <= 15 ? "text-cyan" : "text-foreground";
              const rel = diff < 0 ? `${Math.abs(diff)}d atrás` : diff === 0 ? "hoje" : `em ${diff}d`;
              return <div><div className={`font-mono text-xs ${tone}`}>{d.toLocaleDateString("pt-BR")}</div><div className="font-mono text-[9px] uppercase text-muted-foreground">{rel}</div></div>;
            };
            const renderRow = (l: any) => {
              const tier = (l.version_tier as VersionTier | null) ?? "monthly_457";
              const fee = Number(l.legacy_server_fee_brl) > 0 ? Number(l.legacy_server_fee_brl) : (l.is_legacy ? 250 : 450);
              const tierTone = tier === "lifetime_46" ? "text-violet" : tier === "monthly_457" ? "text-neon" : "text-cyan";
              return (
                <tr key={l.id} className="border-b border-border/20 hover:bg-neon/5">
                  <td className="p-3 whitespace-nowrap">{expiresCell(l)}</td>
                  <td className="p-3 whitespace-nowrap">{statusPill(l)}{l.is_trial && <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">trial · 1d</div>}</td>
                  <td className="p-3">
                    <div className="font-mono text-xs text-foreground">{l.profile?.email ?? <span className="text-muted-foreground">—</span>}</div>
                    {l.profile?.full_name && <div className="font-mono text-[10px] text-muted-foreground">{l.profile.full_name}</div>}
                    <div className="mt-0.5 font-mono text-[10px] text-cyan">login: {l.yaarsa_username}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-xs text-foreground">{l.plan_slug}</div>
                    <div className={`font-mono text-[10px] uppercase ${tierTone}`}>{tierLabel(tier)}</div>
                    {l.is_legacy && <div className="font-mono text-[9px] uppercase text-cyan">cliente antigo</div>}
                  </td>
                  <td className="p-3 font-mono text-xs whitespace-nowrap">{l.is_trial ? <span className="text-muted-foreground">—</span> : <>{formatBrl(fee)}<span className="text-muted-foreground">/mês</span></>}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" title="Renovar servidor (próx. dia 20)" onClick={() => renew(l.id)}><RefreshCw className="h-3 w-3 text-cyan" /></Button>
                    <Button size="sm" variant="ghost" title="Recriar credenciais do login" onClick={() => recreate(l.id)}><RotateCw className="h-3 w-3 text-violet" /></Button>
                    <Button size="sm" variant="ghost" title="Estender manualmente" onClick={() => extend(l.id)}><Calendar className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" title="Revogar" onClick={() => revoke(l.id)}><Ban className="h-3 w-3 text-danger" /></Button>
                  </td>
                </tr>
              );
            };
            const headerRow = (
              <thead className="border-b border-border/40 font-mono text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left whitespace-nowrap">Vencimento</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Usuário</th>
                  <th className="p-3 text-left">Plano</th>
                  <th className="p-3 text-left whitespace-nowrap">Servidor</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
            );
            type Group = { key: string; label: string; order: number; tone: string; items: any[] };
            const groups: Group[] = licView === "grouped"
              ? Array.from(filtered.reduce<Map<string, Group>>((m, l) => {
                  const b = bucketOf(l);
                  if (!m.has(b.key)) m.set(b.key, { ...b, items: [] });
                  m.get(b.key)!.items.push(l);
                  return m;
                }, new Map<string, Group>()).values()).sort((a, b) => a.order - b.order)
              : [];
            groups.forEach((g) => g.items.sort((a: any, b: any) => (new Date(a.expires_at ?? 0).getTime()) - (new Date(b.expires_at ?? 0).getTime())));

            const sortedFlat = licView === "table"
              ? [...filtered].sort((a, b) => {
                  const ax = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
                  const bx = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
                  return ax - bx;
                })
              : [];
            return (
              <div className="terminal-card scanlines relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {filtered.length} de {licenses.length} · trials {trialsCount} · pagas {paidCount}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={licSearch}
                      onChange={(e) => setLicSearch(e.target.value)}
                      placeholder="buscar email, login, plano…"
                      className="h-7 w-52 rounded border border-border/40 bg-background/40 px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-neon/60 focus:outline-none"
                    />
                    <div className="flex overflow-hidden rounded border border-border/40 bg-background/40 font-mono text-[10px] uppercase tracking-wider">
                      {([
                        { k: "all", label: "todas" },
                        { k: "active", label: "ativas" },
                        { k: "expiring", label: "expirando" },
                        { k: "expired", label: "vencidas" },
                        { k: "revoked", label: "revogadas" },
                      ] as const).map((t) => (
                        <button key={t.k} onClick={() => setLicStatus(t.k)}
                          className={`px-2 py-1 transition-colors ${licStatus === t.k ? "bg-neon/15 text-neon" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex overflow-hidden rounded border border-border/40 bg-background/40 font-mono text-[10px] uppercase tracking-wider">
                      {([
                        { k: "all", label: "todos" },
                        { k: "trial", label: `trials · ${trialsCount}` },
                        { k: "paid", label: `pagas · ${paidCount}` },
                      ] as const).map((t) => (
                        <button key={t.k} onClick={() => setLicKind(t.k)}
                          className={`px-2 py-1 transition-colors ${licKind === t.k ? "bg-neon/15 text-neon" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex overflow-hidden rounded border border-border/40 bg-background/40 font-mono text-[10px] uppercase tracking-wider">
                      {([
                        { k: "table", label: "tabela" },
                        { k: "grouped", label: "por vencimento" },
                      ] as const).map((t) => (
                        <button key={t.k} onClick={() => setLicView(t.k)}
                          className={`px-2 py-1 transition-colors ${licView === t.k ? "bg-violet/15 text-violet" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {licView === "table" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[960px] text-sm">
                      {headerRow}
                      <tbody>{sortedFlat.map(renderRow)}</tbody>
                    </table>
                    {sortedFlat.length === 0 && <div className="p-6 text-center font-mono text-xs uppercase text-muted-foreground">nenhuma licença corresponde ao filtro</div>}
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {groups.map((g) => (
                      <div key={g.key}>
                        <div className="flex items-center justify-between bg-background/40 px-3 py-2">
                          <div className={`font-mono text-[11px] font-bold uppercase tracking-wider ${g.tone}`}>{g.label}</div>
                          <div className="font-mono text-[10px] uppercase text-muted-foreground">{g.items.length} licença{g.items.length === 1 ? "" : "s"}</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[960px] text-sm">
                            {headerRow}
                            <tbody>{g.items.map(renderRow)}</tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                    {groups.length === 0 && <div className="p-6 text-center font-mono text-xs uppercase text-muted-foreground">nenhuma licença corresponde ao filtro</div>}
                  </div>
                )}
              </div>
            );
          })()}

          {tab === "staff" && (
            <div className="terminal-card scanlines relative overflow-hidden">
              <div className="border-b border-border/40 p-3 font-mono text-xs uppercase text-muted-foreground">
                <ShieldCheck className="mr-1 inline h-3 w-3 text-neon" /> Promova usuários para admin ou suporte (moderator).
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-border/40 font-mono text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Email</th><th className="p-3 text-left">Cargo atual</th><th className="p-3 text-right">Ações</th></tr></thead>
                  <tbody>{users.map((u) => {
                    const current = roles.find((r) => r.user_id === u.id)?.role ?? "user";
                    return (
                      <tr key={u.id} className="border-b border-border/20">
                        <td className="p-3 break-all">{u.email}</td>
                        <td className={`p-3 font-mono text-xs uppercase whitespace-nowrap ${current === "admin" ? "text-neon" : current === "moderator" ? "text-cyan" : "text-muted-foreground"}`}>{current}</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" disabled={current === "admin"} onClick={() => setRole(u.id, "admin")}>Admin</Button>
                          <Button size="sm" variant="ghost" disabled={current === "moderator"} onClick={() => setRole(u.id, "moderator")}>Suporte</Button>
                          <Button size="sm" variant="ghost" disabled={current === "user"} onClick={() => setRole(u.id, "user")}>Usuário</Button>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "referrals" && <ReferralsAdminPanel />}
          {tab === "logs" && <AdminLogsPanel />}
          {tab === "audit" && <AutoRevocationsPanel users={users} licenses={licenses} />}
          {tab === "ia" && <LicenseAiPanel />}
          {tab === "apk" && <AdminApkPanel />}
          {tab === "market" && <AdminMarketPanel />}
          {tab === "updates" && <AdminUpdatesPanel />}



          </div>
        </div>
      </main>
    </div>
  );
}


function exportLogsCsv(rows: any[], outcome: string) {
  const cols = ["created_at","action","endpoint_kind","url","attempt","http_status","latency_ms","outcome","error","response_body","payload","context"];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `server-logs${outcome ? `-${outcome}` : ""}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminLogsPanel() {
  const listFn = useServerFn(adminListLogs);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await listFn({ data: { source: "yaarsa", outcome: outcome || undefined, limit: 200 } });
      setRows(r as any[]);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [outcome]);

  const outcomeColor = (o: string) => {
    if (o === "success") return "text-neon";
    if (o?.startsWith("yaarsa_code_")) return "text-danger";
    if (o === "http_error" || o === "http_error_retry") return "text-orange-400";
    if (o === "network_error") return "text-danger";
    if (o === "yaarsa_fail") return "text-danger";
    return "text-muted-foreground";
  };

  return (
    <div className="terminal-card scanlines relative overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 p-3">
        <ScrollText className="h-4 w-4 text-neon" />
        <span className="font-mono text-xs uppercase tracking-wider text-cyan">// logs de integração do servidor</span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="rounded border border-border/50 bg-background/60 px-2 py-1 font-mono text-[11px]"
          >
            <option value="">todos os resultados</option>
            <option value="success">success</option>
            <option value="yaarsa_fail">yaarsa_fail</option>
            <option value="yaarsa_code_1003">código 1003 (chave)</option>
            <option value="yaarsa_code_1004">código 1004 (duplicado)</option>
            <option value="http_error">http_error</option>
            <option value="http_error_retry">http_error_retry</option>
            <option value="network_error">network_error</option>
            <option value="html_response">html_response</option>
            <option value="unparseable">unparseable</option>
            <option value="unexpected">unexpected</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => exportLogsCsv(rows, outcome)} disabled={rows.length === 0} className="font-mono text-xs uppercase">
            <Download className="h-3 w-3" />
            <span className="ml-1">CSV</span>
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="font-mono text-xs uppercase">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            <span className="ml-1">Atualizar</span>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40 font-mono text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Hora</th>
              <th className="p-2 text-left">Ação</th>
              <th className="p-2 text-left">Rota</th>
              <th className="p-2 text-left">Tent.</th>
              <th className="p-2 text-left">HTTP</th>
              <th className="p-2 text-left">Latência</th>
              <th className="p-2 text-left">Resultado</th>
              <th className="p-2 text-left">Erro / Resposta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const isOpen = expanded === l.id;
              return (
                <>
                  <tr
                    key={l.id}
                    onClick={() => setExpanded(isOpen ? null : l.id)}
                    className="cursor-pointer border-b border-border/20 font-mono text-[11px] hover:bg-neon/5"
                  >
                    <td className="whitespace-nowrap p-2 text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-2 uppercase">{l.action || "—"}</td>
                    <td className="p-2">
                      <span className={l.endpoint_kind === "PROXY" ? "text-violet" : "text-cyan"}>{l.endpoint_kind || "—"}</span>
                      <div className="max-w-[280px] truncate text-[10px] text-muted-foreground">{l.url}</div>
                    </td>
                    <td className="p-2">{l.attempt ?? "—"}</td>
                    <td className={`p-2 ${l.http_status && l.http_status >= 400 ? "text-danger" : l.http_status === 200 ? "text-neon" : ""}`}>{l.http_status ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{l.latency_ms ? `${l.latency_ms}ms` : "—"}</td>
                    <td className={`p-2 uppercase ${outcomeColor(l.outcome)}`}>{l.outcome}</td>
                    <td className="max-w-[360px] p-2">
                      <div className="truncate text-danger/80">{l.error || ""}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{l.response_body || ""}</div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={l.id + "-d"} className="border-b border-border/40 bg-background/60">
                      <td colSpan={8} className="p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="mb-1 font-mono text-[10px] uppercase text-cyan">// payload enviado</div>
                            <pre className="max-h-64 overflow-auto rounded border border-border/40 bg-black/40 p-2 font-mono text-[10px] text-foreground/80">
{JSON.stringify(l.payload, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="mb-1 font-mono text-[10px] uppercase text-cyan">// resposta bruta</div>
                            <pre className="max-h-64 overflow-auto rounded border border-border/40 bg-black/40 p-2 font-mono text-[10px] text-foreground/80">
{l.response_body || "(vazio)"}
                            </pre>
                            {l.context && (
                              <>
                                <div className="mb-1 mt-2 font-mono text-[10px] uppercase text-violet">// contexto</div>
                                <pre className="max-h-40 overflow-auto rounded border border-border/40 bg-black/40 p-2 font-mono text-[10px] text-foreground/70">
{JSON.stringify(l.context, null, 2)}
                                </pre>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={8} className="p-8 text-center font-mono text-xs text-muted-foreground">nenhum log ainda — dispare uma ação (trial, checkout, renovar) para gerar logs</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExecStat({ icon: Icon, label, value, sub, accent, pulse }: { icon: any; label: string; value: string; sub: string; accent: "neon" | "cyan" | "violet"; pulse?: boolean }) {
  const color = accent === "neon" ? "text-neon" : accent === "cyan" ? "text-cyan" : "text-violet";
  return (
    <div className="terminal-card scanlines group relative overflow-hidden p-4 transition-all hover:-translate-y-0.5">
      <div className={`absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-70 ${color}`} />
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <div className={`mt-2 flex items-center gap-2 font-mono text-2xl font-bold ${color}`}>
        {pulse && <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-current" />}
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase text-muted-foreground/70">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: "neon" | "cyan" | "violet" }) {
  const color = accent === "neon" ? "text-neon" : accent === "cyan" ? "text-cyan" : "text-violet";
  return (
    <div className="rounded border border-border/40 bg-background/40 p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}




// ============= LIVE CHAT PANEL =============
type Thread = { id: string; user_id: string; subject: string; status: string; updated_at: string; assigned_to?: string | null; assigned_name?: string | null; unread_by_staff?: number; last_customer_message_at?: string | null; profile: { email: string; full_name: string | null } | null };
type Msg = { id: string; thread_id: string; body: string | null; attachment_url: string | null; attachment_type: string | null; is_admin: boolean; is_system?: boolean; created_at: string; sender_id: string };

function AdminChatPanel() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "mine" | "closed">("open");
  // Default sound preference when nothing is stored yet.
  const SOUND_DEFAULT_ON = true;
  const [soundOn, setSoundOn] = useState<boolean>(SOUND_DEFAULT_ON);
  const [soundHydrated, setSoundHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const bootAtRef = useRef<number>(Date.now());
  const soundOnRef = useRef(soundOn);
  // Hydrate persisted preference after mount to avoid SSR mismatch/flash.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin.chat.sound");
      if (saved === "on") setSoundOn(true);
      else if (saved === "off") setSoundOn(false);
      else setSoundOn(SOUND_DEFAULT_ON);
    } catch { /* ignore */ }
    setSoundHydrated(true);
  }, []);
  useEffect(() => {
    soundOnRef.current = soundOn;
    if (!soundHydrated) return;
    try { localStorage.setItem("admin.chat.sound", soundOn ? "on" : "off"); } catch { /* ignore */ }
  }, [soundOn, soundHydrated]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const threadsFn = useServerFn(adminListThreads);
  const msgsFn = useServerFn(adminListThreadMessages);
  const sendFn = useServerFn(adminSendMessage);
  const assumeFn = useServerFn(adminAssumeThread);
  const closeFn = useServerFn(adminCloseThread);

  const refreshThreads = () => threadsFn({ data: { filter } }).then((t) => setThreads(t as Thread[])).catch(() => {});


  useEffect(() => {
    requestNotifyPermission();
    threadsFn({ data: { filter } }).then((t) => {
      setThreads(t as Thread[]);
      setLoading(false);
      if ((t as Thread[]).length && !activeId) setActiveId((t as Thread[])[0].id);
    }).catch(() => setLoading(false));
    const ch = supabase.channel(`admin-threads-${filter}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "support_messages" },
      (payload) => {
        const msg = payload.new as Msg;
        threadsFn({ data: { filter } }).then((t) => {
          setThreads(t as Thread[]);
          if (!msg.is_admin && soundOnRef.current && new Date(msg.created_at).getTime() >= bootAtRef.current) {
            playNotifyDing();
            const th = (t as Thread[]).find((x) => x.id === msg.thread_id);
            if (document.hidden || msg.thread_id !== activeIdRef.current) {
              showDesktopNotification(
                `Nova mensagem — ${th?.profile?.email ?? "cliente"}`,
                (msg.body ?? "[anexo]").slice(0, 140),
              );
            }
          }
        }).catch(() => {});
      }
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (!activeId) return;
    msgsFn({ data: { threadId: activeId } }).then((m) => setMsgs(m as Msg[])).catch(() => {});
    const ch = supabase.channel(`admin-t-${activeId}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${activeId}` },
      (payload) => setMsgs((prev) => {
        const next = payload.new as Msg;
        if (prev.some((x) => x.id === next.id)) return prev;
        return [...prev, next];
      })
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, msgsFn]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs.length]);
  useEffect(() => { inputRef.current?.focus(); }, [activeId]);


  async function send() {
    if (!activeId || !body.trim()) return;
    unlockNotifySound();
    setSending(true);
    try { await sendFn({ data: { threadId: activeId, body: body.trim() } }); setBody(""); }
    catch (e: any) { toast.error(e.message); }
    setSending(false);
    inputRef.current?.focus();
  }

  const filtered = threads.filter((t) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (t.profile?.email ?? "").toLowerCase().includes(q) || (t.profile?.full_name ?? "").toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
  });

  const activeThread = threads.find((t) => t.id === activeId);

  return (
    <div className="terminal-card scanlines relative grid h-[70vh] grid-cols-1 overflow-hidden md:grid-cols-[320px_1fr]">
      {/* Thread list */}
      <aside className="flex flex-col border-b border-border/40 md:border-b-0 md:border-r">
        <div className="border-b border-border/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-neon">
              <MessageSquare className="h-3.5 w-3.5" /> conversas
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { unlockNotifySound(); setSoundOn((s) => !s); if (!soundOn) playNotifyDing(); }}
                title={soundOn ? "Silenciar notificações" : "Ativar som de notificação"}
                aria-hidden={!soundHydrated}
                className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-opacity ${soundHydrated ? "opacity-100" : "opacity-0 pointer-events-none"} ${soundOn ? "border-neon/40 bg-neon/5 text-neon" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
              >
                {soundOn ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
              </button>
              <span className="font-mono text-[10px] text-muted-foreground">{threads.length}</span>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="buscar cliente..." className="h-8 pl-8 font-mono text-xs" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6 text-center text-xs text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
          {!loading && filtered.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma conversa</div>}
          {filtered.map((t) => {
            const active = t.id === activeId;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`flex w-full items-center gap-3 border-b border-border/20 p-3 text-left transition-colors ${active ? "bg-neon/10" : "hover:bg-neon/5"}`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${active ? "bg-neon text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {(t.profile?.email ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs text-foreground">{t.profile?.email ?? "cliente"}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${t.status === "open" ? "bg-neon" : "bg-muted-foreground"}`} />
                    <span className="truncate font-mono text-[10px] uppercase text-muted-foreground">{t.status}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">· {new Date(t.updated_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat area */}
      <section className="flex min-h-0 flex-col">
        {!activeThread ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 text-neon/50" />
            <div className="font-mono text-xs uppercase">Selecione uma conversa</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <div>
                <div className="font-mono text-sm">{activeThread.profile?.email ?? "cliente"}</div>
                <div className="font-mono text-[10px] uppercase text-muted-foreground">{activeThread.subject} · thread {activeThread.id.slice(0, 8)}</div>
              </div>
              <div className="flex items-center gap-2">
                <IssueInThreadButton
                  threadId={activeThread.id}
                  defaultEmail={activeThread.profile?.email ?? ""}
                />
                <div className="flex items-center gap-2 rounded border border-neon/30 bg-neon/5 px-2 py-1 font-mono text-[10px] uppercase text-neon">
                  <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-neon" /> ao vivo
                </div>
              </div>
            </div>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-background/30 p-4">
              {msgs.length === 0 && <div className="pt-16 text-center text-xs text-muted-foreground">Sem mensagens ainda — inicie a conversa.</div>}
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.is_admin ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.is_admin ? "border border-violet/40 bg-violet/10" : "border border-border bg-card"}`}>
                    <div className="mb-1 font-mono text-[9px] uppercase text-muted-foreground">
                      {m.is_admin ? "você (admin)" : "cliente"} · {new Date(m.created_at).toLocaleTimeString("pt-BR")}
                    </div>
                    {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                    {m.attachment_url && (
                      m.attachment_type?.startsWith("image/") ? <img src={m.attachment_url} alt="anexo" className="mt-2 max-h-64 rounded" />
                      : m.attachment_type?.startsWith("video/") ? <video src={m.attachment_url} controls className="mt-2 max-h-64 rounded" />
                      : <a href={m.attachment_url} target="_blank" rel="noreferrer" className="mt-2 block text-cyan underline">Baixar anexo</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <form className="flex items-center gap-2 border-t border-border/40 p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <Input ref={inputRef} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Responder cliente..." className="font-mono text-sm" />
              <Button type="submit" disabled={sending || !body.trim()} className="glow-neon font-mono uppercase tracking-wider">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-2 h-3.5 w-3.5" />Enviar</>}
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

// ============ Emitir licença (formulário completo) ============
function IssueLicensePanel({ onIssued, initialEmail, initialThreadId, compact }: {
  onIssued?: () => void;
  initialEmail?: string;
  initialThreadId?: string;
  compact?: boolean;
}) {
  const issueFn = useServerFn(adminCreateLicenseForClient);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [plan, setPlan] = useState<"login-7d" | "login-30d" | "login-lifetime">("login-30d");
  const [panel, setPanel] = useState<"v457" | "v46" | "auto">("auto");
  const [isLegacy, setIsLegacy] = useState(false);
  const [fee, setFee] = useState<string>("250");
  const [customExpire, setCustomExpire] = useState<string>("");
  const [postToThread, setPostToThread] = useState<boolean>(!!initialThreadId);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("Informe o email do cliente");
    setBusy(true); setResult(null);
    try {
      const r = await issueFn({
        data: {
          userEmail: email.trim().toLowerCase(),
          planSlug: plan,
          panel: panel === "auto" ? undefined : panel,
          isLegacy,
          customExpireDate: customExpire || undefined,
          legacyServerFeeBrl: isLegacy ? Number(fee) || 250 : undefined,
          postToThreadId: postToThread && initialThreadId ? initialThreadId : undefined,
        },
      });
      setResult(r);
      toast.success(`Licença emitida (${tierLabel(r.version_tier as VersionTier)})${r.invited ? " · convite enviado" : ""}`);
      onIssued?.();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao emitir licença");
    } finally { setBusy(false); }
  }

  return (
    <div className={compact ? "" : "terminal-card scanlines relative p-5"}>
      {!compact && (
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neon" />
          <h3 className="font-mono text-sm uppercase text-neon">// emitir licença para cliente</h3>
        </div>
      )}
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Email do cliente</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" required />
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Plano</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value as any)} className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm">
            <option value="login-7d">Semanal (7d · v4.5.5)</option>
            <option value="login-30d">Mensal (30d · v4.5.7 + Bypass)</option>
            <option value="login-lifetime">Vitalício (v4.6 + updates + prioridade)</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Painel</span>
          <select value={panel} onChange={(e) => setPanel(e.target.value as any)} className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm">
            <option value="auto">Auto (pelo plano)</option>
            <option value="v457">Shadow 4.5.7 (VPS 191.96.78.81)</option>
            <option value="v46">Shadow 4.6 (VPS 200.9.154.103)</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Expira (opcional)</span>
          <Input type="date" value={customExpire} onChange={(e) => setCustomExpire(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 rounded border border-border/40 bg-background/40 px-3 py-2">
          <input type="checkbox" checked={isLegacy} onChange={(e) => setIsLegacy(e.target.checked)} />
          <span className="font-mono text-xs uppercase">Cliente antigo</span>
        </label>
        <label className={isLegacy ? "" : "opacity-50 pointer-events-none"}>
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Taxa mensal servidor (R$)</span>
          <Input type="number" min={0} step="1" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        {initialThreadId && (
          <label className="md:col-span-2 flex items-center gap-2 rounded border border-violet/30 bg-violet/5 px-3 py-2">
            <input type="checkbox" checked={postToThread} onChange={(e) => setPostToThread(e.target.checked)} />
            <span className="font-mono text-xs">Postar credenciais neste chat automaticamente</span>
          </label>
        )}
        <div className="md:col-span-2">
          <Button type="submit" disabled={busy} className="glow-neon font-mono uppercase tracking-wider">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Emitir licença
          </Button>
        </div>
      </form>
      {result && (
        <div className="mt-4 rounded border border-neon/30 bg-neon/5 p-3 font-mono text-xs">
          <div className="mb-1 uppercase text-neon">// licença criada</div>
          <div>user: <span className="text-foreground">{result.credentials.username}</span></div>
          <div>email: <span className="text-foreground">{result.credentials.email}</span></div>
          <div>senha: <span className="text-foreground">{result.credentials.password}</span></div>
          <div>servidor: <span className="text-foreground">{result.credentials.server_ip}</span></div>
          <div>expira: <span className="text-foreground">{new Date(result.expires_at).toLocaleString("pt-BR")}</span></div>
        </div>
      )}
    </div>
  );
}

function IssueInThreadButton({ threadId, defaultEmail }: { threadId: string; defaultEmail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="outline" className="font-mono text-[10px] uppercase" onClick={() => setOpen((v) => !v)}>
        <UserPlus className="mr-1 h-3 w-3" /> {open ? "Fechar" : "Emitir licença"}
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-[520px] max-w-[92vw] rounded-lg border border-neon/30 bg-background/95 p-4 shadow-2xl">
          <IssueLicensePanel
            initialEmail={defaultEmail}
            initialThreadId={threadId}
            compact
            onIssued={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}


// ============ LegacyClientsPanel ============
// Registra clientes antigos com login existente já existente (sem criar conta
// nova) e mostra em uma tabela abaixo TODOS os `is_legacy=true` já ativados,
// com data de ativação e taxa mensal aplicada.
function LegacyClientsPanel({ licenses, onChanged }: { licenses: any[]; onChanged: () => void }) {
  const registerFn = useServerFn(adminRegisterLegacyLicense);

  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"login-7d" | "login-30d" | "login-lifetime">("login-lifetime");
  const [yaarsaUsername, setYaarsaUsername] = useState("");
  const [yaarsaEmail, setYaarsaEmail] = useState("");
  const [yaarsaPassword, setYaarsaPassword] = useState("");
  const [serverIp, setServerIp] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [fee, setFee] = useState("250");
  const [panel, setPanel] = useState<"v457" | "v46" | "auto">("auto");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ panels: string[]; found: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const legacyList = [...licenses]
    .filter((l) => l.is_legacy)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  // ---- filtros / paginação da lista abaixo ----
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "overdue" | "revoked" | "disabled">("all");
  const [tierFilter, setTierFilter] = useState<"all" | VersionTier>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const filteredLegacy = legacyList.filter((l) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hay = `${l.yaarsa_username ?? ""} ${l.yaarsa_email ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (tierFilter !== "all" && (l.version_tier ?? "monthly_457") !== tierFilter) return false;
    if (statusFilter !== "all") {
      const s = l.disabled_at ? "disabled" : l.revoked ? "revoked" : l.server_overdue_at ? "overdue" : "active";
      if (s !== statusFilter) return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredLegacy.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredLegacy.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [query, statusFilter, tierFilter]);

  const counts = {
    total: legacyList.length,
    active: legacyList.filter((l) => !l.disabled_at && !l.revoked && !l.server_overdue_at).length,
    overdue: legacyList.filter((l) => !l.disabled_at && !l.revoked && l.server_overdue_at).length,
    revoked: legacyList.filter((l) => l.revoked && !l.disabled_at).length,
    disabled: legacyList.filter((l) => l.disabled_at).length,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !yaarsaUsername.trim() || !yaarsaEmail.trim() || !yaarsaPassword.trim() || !expiresAt) {
      return toast.error("Preencha todos os campos obrigatórios");
    }
    setBusy(true); setLastResult(null);
    try {
      const r = await registerFn({
        data: {
          userEmail: email.trim().toLowerCase(),
          planSlug: plan,
          yaarsaUsername: yaarsaUsername.trim(),
          yaarsaEmail: yaarsaEmail.trim().toLowerCase(),
          yaarsaPassword: yaarsaPassword,
          serverIp: serverIp.trim() || undefined,
          expiresAt: new Date(expiresAt).toISOString(),
          legacyServerFeeBrl: Number(fee) || 250,
          panel: panel === "auto" ? undefined : panel,
        },
      });
      setLastResult(r);
      toast.success(`Cliente antigo registrado (${tierLabel(r.version_tier as VersionTier)})${r.invited ? " · convite enviado" : ""}`);
      // Limpar apenas campos sensíveis; mantém plano/taxa para lote
      setYaarsaUsername(""); setYaarsaEmail(""); setYaarsaPassword(""); setServerIp(""); setEmail("");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao registrar cliente antigo");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="terminal-card scanlines relative p-5">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-cyan" />
          <h3 className="font-mono text-sm uppercase text-cyan">// registrar cliente antigo (login existente)</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Use esta tela para <b className="text-foreground">clientes que já têm login existente</b>. Nenhuma nova conta é criada;
          apenas vinculamos o login existente ao usuário e marcamos como <span className="font-mono text-cyan">legacy</span>
          (taxa mensal de servidor R$ 250 em vez de R$ 450). Para gerar um login novo do zero, use "Emitir Licença".
        </p>

        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Email do cliente no Shadow *</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" required />
          </label>

          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Plano / Tier *</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value as any)} className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm">
              <option value="login-7d">Semanal · v4.5.5</option>
              <option value="login-30d">Mensal · v4.5.7 + Bypass</option>
              <option value="login-lifetime">Vitalício · v4.6 + updates + prioridade</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Expira em *</span>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required />
          </label>

          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Login · username *</span>
            <Input value={yaarsaUsername} onChange={(e) => setYaarsaUsername(e.target.value)} placeholder="ex: abcde" required />
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Login · email *</span>
            <Input type="email" value={yaarsaEmail} onChange={(e) => setYaarsaEmail(e.target.value)} placeholder="login@shadow.local" required />
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Login · senha *</span>
            <Input value={yaarsaPassword} onChange={(e) => setYaarsaPassword(e.target.value)} placeholder="senha existente" required />
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">IP do servidor (opcional)</span>
            <Input value={serverIp} onChange={(e) => setServerIp(e.target.value)} placeholder="191.96.78.81" />
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Painel</span>
            <select value={panel} onChange={(e) => setPanel(e.target.value as any)} className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm">
              <option value="auto">Auto (pelo plano)</option>
              <option value="v457">Shadow 4.5.7 (VPS 191.96.78.81)</option>
              <option value="v46">Shadow 4.6 (VPS 200.9.154.103)</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">Taxa mensal servidor (R$)</span>
            <Input type="number" min={0} step="1" value={fee} onChange={(e) => setFee(e.target.value)} />
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-2 rounded border border-cyan/20 bg-cyan/5 p-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={lookupBusy || !yaarsaEmail.trim()}
              onClick={async () => {
                setLookupBusy(true); setLookupResult(null);
                try {
                  const { adminLookupYaarsaEmail } = await import("@/lib/admin.functions");
                  const r = await adminLookupYaarsaEmail({ data: { email: yaarsaEmail.trim().toLowerCase() } });
                  setLookupResult({ found: r.found, panels: (r.details ?? []).filter((d: any) => d.found).map((d: any) => d.panel) });
                  if (r.found) toast.success(`Login encontrado em: ${r.panel === "v46" ? "Shadow 4.6" : "Shadow 4.5.7"}`);
                  else toast.error("Email não encontrado em nenhum painel");
                } catch (e: any) { toast.error(e?.message || "Falha ao consultar servidor"); }
                finally { setLookupBusy(false); }
              }}
              className="font-mono text-[10px] uppercase"
            >
              {lookupBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <History className="mr-1 h-3 w-3" />}
              Verificar email nos painéis
            </Button>
            {lookupResult && (
              <span className="font-mono text-[11px]">
                {lookupResult.found ? (
                  <span className="text-neon">✓ encontrado em: {lookupResult.panels.join(", ")}</span>
                ) : (
                  <span className="text-red-400">✗ não encontrado em nenhum painel</span>
                )}
              </span>
            )}
          </div>


          <div className="md:col-span-2">
            <Button type="submit" disabled={busy} className="glow-cyan font-mono uppercase tracking-wider">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Registrar cliente antigo
            </Button>
          </div>
        </form>

        {lastResult && (
          <div className="mt-4 rounded border border-cyan/30 bg-cyan/5 p-3 font-mono text-xs">
            <div className="mb-1 uppercase text-cyan">// registrado</div>
            <div>licença: <span className="text-foreground">{lastResult.licenseId}</span></div>
            <div>tier: <span className="text-foreground">{tierLabel(lastResult.version_tier as VersionTier)}</span></div>
            {lastResult.invited && <div className="text-neon">convite enviado ao email do cliente</div>}
          </div>
        )}
      </div>

      <div className="terminal-card scanlines relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-3">
          <div className="font-mono text-xs uppercase text-muted-foreground">
            <History className="mr-1 inline h-3 w-3 text-cyan" /> Clientes antigos ativados
            <span className="ml-2 text-cyan">({counts.total})</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase">
            <span className="text-neon">● {counts.active} ativas</span>
            <span className="text-amber-400">● {counts.overdue} atrasadas</span>
            <span className="text-danger">● {counts.revoked} revogadas</span>
            <span className="text-muted-foreground">● {counts.disabled} desativadas</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid gap-2 border-b border-border/40 bg-background/30 p-3 sm:flex sm:flex-wrap sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por usuário ou email…"
            className="w-full border border-border/50 bg-background/60 px-3 py-2 font-mono text-sm outline-none focus:border-cyan sm:min-w-[220px] sm:flex-1 sm:py-1.5 sm:text-xs"
          />
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full border border-border/50 bg-background/60 px-2 py-2 font-mono text-[11px] uppercase sm:w-auto sm:py-1.5 sm:text-[10px]"
            >
              <option value="all">Todos status</option>
              <option value="active">Ativa</option>
              <option value="overdue">Servidor atrasado</option>
              <option value="revoked">Revogada</option>
              <option value="disabled">Desativada</option>
            </select>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as any)}
              className="w-full border border-border/50 bg-background/60 px-2 py-2 font-mono text-[11px] uppercase sm:w-auto sm:py-1.5 sm:text-[10px]"
            >
              <option value="all">Todos tiers</option>
              <option value="lifetime_46">Vitalício 4.6</option>
              <option value="monthly_457">Mensal 4.5.7</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
          {(query || statusFilter !== "all" || tierFilter !== "all") && (
            <button
              onClick={() => { setQuery(""); setStatusFilter("all"); setTierFilter("all"); }}
              className="w-full border border-border/50 px-2 py-2 font-mono text-[11px] uppercase text-muted-foreground hover:border-cyan hover:text-cyan sm:w-auto sm:py-1.5 sm:text-[10px]"
            >
              limpar
            </button>
          )}
          <div className="font-mono text-[11px] uppercase text-muted-foreground sm:ml-auto sm:text-[10px]">
            {filteredLegacy.length} resultado{filteredLegacy.length === 1 ? "" : "s"}
          </div>
        </div>


        {filteredLegacy.length === 0 ? (
          <div className="p-8 text-center font-mono text-xs uppercase text-muted-foreground">
            {legacyList.length === 0 ? "Nenhum cliente antigo registrado ainda." : "Nenhum resultado para os filtros aplicados."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((l) => {
                const tier = (l.version_tier as VersionTier | null) ?? "monthly_457";
                const fee = Number(l.legacy_server_fee_brl) > 0 ? Number(l.legacy_server_fee_brl) : 250;
                const status = l.disabled_at ? "desativada" : l.revoked ? "revogada" : l.server_overdue_at ? "servidor atrasado" : "ativa";
                const statusColor = l.disabled_at || l.revoked ? "border-danger/60 text-danger" : l.server_overdue_at ? "border-amber-400/60 text-amber-400" : "border-neon/60 text-neon";
                const tierColor = tier === "lifetime_46" ? "text-violet" : tier === "monthly_457" ? "text-neon" : "text-cyan";
                const daysToExpire = l.expires_at ? Math.ceil((+new Date(l.expires_at) - Date.now()) / 86400000) : null;
                return (
                  <div key={l.id} className="group relative border border-border/40 bg-background/40 p-4 transition hover:border-cyan/60 hover:bg-cyan/5 sm:p-3">
                    <div className="mb-3 flex items-start justify-between gap-2 sm:mb-2">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm text-foreground">{l.yaarsa_username || "—"}</div>
                        <div className="truncate font-mono text-xs text-muted-foreground sm:text-[10px]">{l.yaarsa_email || "—"}</div>
                      </div>
                      <span className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase sm:text-[9px] ${statusColor}`}>{status}</span>
                    </div>
                    <div className="mb-3 flex items-center justify-between gap-2 border-y border-border/30 py-2 sm:mb-2">
                      <span className={`font-mono text-[11px] uppercase sm:text-[10px] ${tierColor}`}>{tierLabel(tier)}</span>
                      <span className="font-mono text-sm sm:text-xs">
                        {formatBrl(fee)}<span className="text-[11px] text-muted-foreground sm:text-[10px]">/mês</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 font-mono text-xs sm:gap-2 sm:text-[10px]">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[9px]">Licença expira</div>
                        <div className={daysToExpire !== null && daysToExpire <= 7 ? "text-amber-400" : ""}>
                          {l.expires_at ? new Date(l.expires_at).toLocaleDateString("pt-BR") : "—"}
                          {daysToExpire !== null && daysToExpire >= 0 && daysToExpire <= 30 && (
                            <span className="ml-1 text-muted-foreground">({daysToExpire}d)</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[9px]">Servidor pago até</div>
                        <div>{l.server_paid_until ? new Date(l.server_paid_until).toLocaleDateString("pt-BR") : "—"}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[9px]">Ativado em</div>
                        <div>{new Date(l.created_at).toLocaleString("pt-BR")}</div>
                      </div>
                    </div>
                  </div>

                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t border-border/40 p-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border border-border/50 px-3 py-1 font-mono text-[10px] uppercase disabled:opacity-30 hover:border-cyan hover:text-cyan"
                >
                  ← anterior
                </button>
                <div className="font-mono text-[10px] uppercase text-muted-foreground">
                  página <span className="text-cyan">{currentPage}</span> / {totalPages}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="border border-border/50 px-3 py-1 font-mono text-[10px] uppercase disabled:opacity-30 hover:border-cyan hover:text-cyan"
                >
                  próxima →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============ Auditoria: Revogações automáticas do cron diário ============
function AutoRevocationsPanel({ users, licenses }: { users: any[]; licenses: any[] }) {
  const listFn = useServerFn(adminListLogs);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlyFailed, setOnlyFailed] = useState(false);

  const userById = new Map(users.map((u) => [u.id, u.email]));
  const licById = new Map(licenses.map((l) => [l.id, l]));

  async function load() {
    setLoading(true);
    try {
      const r = await listFn({ data: { source: "auto-revoke", limit: 500 } });
      setRows(r as any[]);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const perLicense = rows.filter((r) => r.action === "revoke_license");
  const cronRuns = rows.filter((r) => r.action === "cron");
  const shown = onlyFailed ? perLicense.filter((r) => r.outcome !== "revoked") : perLicense;

  function exportCsv() {
    const cols = ["created_at", "outcome", "user_email", "yaarsa_email", "license_id", "reason", "suspended_until", "error"];
    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [cols.join(",")];
    for (const r of shown) {
      const ctx = r.context || {};
      lines.push(cols.map((c) => {
        if (c === "user_email") return esc(userById.get(ctx.user_id) || "");
        if (c === "created_at" || c === "outcome" || c === "error") return esc(r[c]);
        return esc(ctx[c]);
      }).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auto-revocations-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="terminal-card scanlines relative p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldAlert className="h-4 w-4 text-neon" />
          <div className="flex-1">
            <div className="font-mono text-xs uppercase text-neon">Auditoria de Revogações Automáticas</div>
            <div className="text-[11px] text-muted-foreground">
              Registros gerados pelo cron diário (dia 20 / servidor vencido). Uma linha por licença afetada.
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-mono uppercase text-muted-foreground">
            <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
            só falhas
          </label>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recarregar
          </Button>
          <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!shown.length}>
            <Download className="mr-1 h-3 w-3" /> CSV
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px]">
          <Stat label="Total revogadas" value={perLicense.length} color="text-neon" />
          <Stat label="Suspensas" value={perLicense.filter((r) => r.outcome === "revoked").length} color="text-cyan" />
          <Stat label="Falhas" value={perLicense.filter((r) => r.outcome !== "revoked").length} color="text-red-400" />
          <Stat label="Execuções do cron" value={cronRuns.length} color="text-violet-300" />
        </div>
      </div>

      <div className="terminal-card scanlines relative overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40 bg-background/40 font-mono text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Quando</th>
              <th className="p-3 text-left">Usuário</th>
              <th className="p-3 text-left">Login</th>
              <th className="p-3 text-left">Licença</th>
              <th className="p-3 text-left">Motivo</th>
              <th className="p-3 text-left">Login</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center font-mono text-xs text-muted-foreground">
                {loading ? "carregando…" : "Nenhuma revogação automática registrada."}
              </td></tr>
            )}
            {shown.map((r) => {
              const ctx = r.context || {};
              const lic = licById.get(ctx.license_id);
              const ok = r.outcome === "revoked";
              return (
                <tr key={r.id} className="border-b border-border/20 align-top">
                  <td className="p-3 font-mono text-[11px] whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3 text-xs">
                    <div>{userById.get(ctx.user_id) || <span className="text-muted-foreground">—</span>}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{ctx.user_id?.slice(0, 8)}</div>
                  </td>
                  <td className="p-3 font-mono text-[11px]">{ctx.yaarsa_email || "—"}</td>
                  <td className="p-3 font-mono text-[11px]">
                    <div>{lic?.plan_slug || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{ctx.license_id?.slice(0, 8)}</div>
                  </td>
                  <td className="p-3 font-mono text-[11px] text-amber-300">
                    {ctx.reason === "server_overdue_day20" ? "Servidor vencido (dia 20)" : (ctx.reason || "—")}
                    <div className="text-[10px] text-muted-foreground">até {ctx.suspended_until || "—"}</div>
                  </td>
                  <td className={`p-3 font-mono text-[11px] uppercase ${ok ? "text-cyan" : "text-red-400"}`}>
                    {ok ? "suspenso" : "falhou"}
                    {r.error && <div className="text-[10px] normal-case text-muted-foreground">{r.error}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 px-3 py-1.5">
      <span className={`mr-2 ${color}`}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

// ============ ReferralsAdminPanel ============
function ReferralsAdminPanel() {
  const listFn = useServerFn(adminListReferrals);
  const payFn = useServerFn(adminMarkReferralPaid);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");

  async function load() {
    setLoading(true);
    try { setRows(await listFn() as any[]); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function updateStatus(id: string, status: "pending" | "granted" | "paid") {
    try { await payFn({ data: { referralId: id, status } }); toast.success("Atualizado"); await load(); }
    catch (e: any) { toast.error(e.message); }
  }

  const filtered = rows.filter((r) =>
    filter === "all" ? true : filter === "pending" ? r.reward_status === "pending" : r.reward_status === "paid",
  );
  const totalPending = rows.filter((r) => r.reward_status === "pending").length;
  const totalPixDue = rows
    .filter((r) => r.reward_type === "pix" && r.reward_status === "pending")
    .reduce((s, r) => s + Number(r.reward_amount), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="terminal-card p-4">
          <div className="font-mono text-[10px] uppercase text-muted-foreground">Total de indicações</div>
          <div className="mt-1 font-mono text-2xl text-neon">{rows.length}</div>
        </div>
        <div className="terminal-card p-4">
          <div className="font-mono text-[10px] uppercase text-muted-foreground">Pendentes</div>
          <div className="mt-1 font-mono text-2xl text-amber-300">{totalPending}</div>
        </div>
        <div className="terminal-card p-4">
          <div className="font-mono text-[10px] uppercase text-muted-foreground">PIX a pagar</div>
          <div className="mt-1 font-mono text-2xl text-violet-300">{formatBrl(totalPixDue)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "paid"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}
            className="font-mono text-[10px] uppercase">
            {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : "Pagos"}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={load} className="ml-auto font-mono text-[10px] uppercase">
          <RefreshCw className="mr-1 h-3 w-3" /> Atualizar
        </Button>
      </div>

      <div className="terminal-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center font-mono text-xs text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center font-mono text-xs text-muted-foreground">Nenhuma indicação.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 font-mono text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Indicador</th>
                <th className="p-3 text-left">Indicado</th>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-left">Valor</th>
                <th className="p-3 text-left">Chave PIX</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/20">
                  <td className="p-3 font-mono text-[11px] whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-xs">{r.referrer_email ?? "—"}</td>
                  <td className="p-3 text-xs">{r.referred_email ?? "—"}</td>
                  <td className="p-3 font-mono text-[11px] uppercase">
                    {r.reward_type === "cashback" ? "Cashback" : r.reward_type === "free_month" ? "Mensalidade" : "PIX"}
                  </td>
                  <td className="p-3 font-mono text-[11px]">{formatBrl(Number(r.reward_amount))}</td>
                  <td className="p-3 font-mono text-[11px]">
                    {r.reward_type === "pix" ? (r.pix_key ?? <span className="text-amber-300">sem chave</span>) : "—"}
                  </td>
                  <td className={`p-3 font-mono text-[11px] uppercase ${
                    r.reward_status === "paid" ? "text-neon" :
                    r.reward_status === "granted" ? "text-cyan" : "text-amber-300"
                  }`}>{r.reward_status}</td>
                  <td className="p-3">
                    {r.reward_type === "pix" && r.reward_status === "pending" ? (
                      <Button size="sm" onClick={() => updateStatus(r.id, "paid")} className="font-mono text-[10px] uppercase">
                        <Check className="mr-1 h-3 w-3" /> Pago
                      </Button>
                    ) : r.reward_status !== "pending" ? (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "pending")} className="font-mono text-[10px] uppercase">
                        Reabrir
                      </Button>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

