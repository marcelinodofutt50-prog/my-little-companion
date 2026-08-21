import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Users,
  DollarSign,
  KeyRound,
  Ban,
  Calendar,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  LifeBuoy,
  MessageSquare,
  Reply,
  X,
  Send,
  Loader2,
  Search,
  BarChart3,
  Activity,
  Zap,
  LogOut,
  Circle,
  ScrollText,
  Download,
  UserPlus,
  Sparkles,
  History,
  ShieldAlert,
  Gift,
  Check,
  Bell,
  BellOff,
  Store,
  Package,
  Wallet,
  Copy,
  RotateCcw,
  ChevronLeft,
  Wrench,
  Bot,
  Server,
  Video,
  GraduationCap,
  Megaphone,
  Building2,
  Settings2,
  Paperclip,
} from "lucide-react";


import { categoryMeta } from "@/lib/support-categories";
import { SiteHeader } from "@/components/SiteHeader";
import { AdminAlertsBanner } from "@/components/AdminAlertsBanner";
import { QuickRepliesDropdown } from "@/components/QuickRepliesDropdown";
import { AdminKpiCards } from "@/components/AdminKpiCards";
import { type AuditLogEntry } from "@/components/AdminAuditLog";
import { AdminGlobalSearch } from "@/components/AdminGlobalSearch";
import { SupportCustomerContext } from "@/components/SupportCustomerContext";
import { AdminMobileNav } from "@/components/AdminMobileNav";
import { AdminActiveProblems } from "@/components/AdminActiveProblems";
import { useAdminSectionCounts } from "@/lib/useAdminSectionCounts";
import { AdminTagline } from "@/components/AdminTagline";

import {
  AdminAnnouncementsPanel,
  AdminAntifraudPanel,
  AdminApkPanel,
  AdminAuditLog,
  AdminCustomer360,
  AdminDailyReport,
  AdminEmailMetrics,
  AdminExternalPayersPanel,
  AdminHealthPanel,
  AdminMarketPanel,
  AdminMetricsPanel,
  AdminMigrationWaves,
  AdminPanelServers,
  AdminPermissionsMatrix,
  AdminRedeemCodesPanel,
  AdminRefundsPanel,

  AdminSelfTestPanel,
  AdminSupportPanel,
  AdminTeamGuide,
  AdminTrialMonitorPanel,
  AdminTrialResetPanel,
  AdminTutorialsPanel,
  AdminUpdatesPanel,
  AdminVipPanel,
  LicenseAiPanel,
  RevenueSparkline,
  StaffAcademyPanel,
  StaffNexusChat,
} from "@/components/admin/lazy-panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl, tierLabel, type VersionTier } from "@/lib/plans";
import {
  licenseKindLabel,
  panelOfLicense,
  panelTone,
  planLabel,
} from "@/lib/license-display";
import {
  adminStats,
  adminListUsers,
  adminListOrders,
  adminListLicenses,
  adminRevokeLicense,
  adminExtendLicense,
  adminFixLoginBug,
  adminAnalyzeLoginBug,
  adminSetRole,
  adminSetRoleByEmail,
  adminListRoles,
  adminRenewClientServer,
  adminRecreateLicense,
  adminListThreads,
  adminListThreadMessages,
  adminSendMessage,
  adminListLogs,
  adminAssumeThread,
  adminCloseThread,
  adminCreateLicenseForClient,
  adminRegisterLegacyLicense,
  adminListReferrals,
  adminMarkReferralPaid,
  adminUpdateReferralStatus,
} from "@/lib/admin.functions";

import {
  getMyQuota,
  listSupportQuotas,
  updateSupportQuota,
} from "@/lib/support-quotas.functions";


import {
  adminListAnnouncements,
  adminSaveAnnouncement,
  adminDeleteAnnouncement,
} from "@/lib/announcements.functions";
import {
  playNotifyDing,
  unlockNotifySound,
  requestNotifyPermission,
  showDesktopNotification,
} from "@/lib/notify-sound";
import { secureSignOut } from "@/lib/session";
import { fetchMyRole, isStaffRole } from "@/lib/roles";
import { SECTION_CAP, can, ROLE_LABEL, type Role } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Shadow" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const role = await fetchMyRole(u.user.id);
    if (!isStaffRole(role)) throw redirect({ to: "/dashboard" });
  },
  component: () => (
    <ErrorBoundary name="AdminPage">
      <AdminPage />
    </ErrorBoundary>
  ),
});

type Tab =
  | "overview"
  | "ia"
  | "chat"
  | "issue"
  | "legacy"
  | "external"
  | "users"
  | "orders"
  | "licenses"
  | "referrals"
  | "staff"
  | "logs"
  | "health"
  | "servers"
  | "audit"
  | "apk"
  | "market"
  | "announcements"
  | "updates"
  | "tutorials"
  | "refunds"
  | "quotas"
  | "selftest"
  | "trial_monitor"
  | "nexus"
  | "academy"
  | "redeem"
  | "vip";



// Explicação em linguagem simples de cada seção do painel.
const TAB_DESC: Record<Tab, string> = {
  overview: "Resumo do dia: quanto entrou, o que está pendente e atalhos rápidos.",
  ia: "Diagnóstico automático: a IA aponta erros e o que precisa de atenção.",
  chat: "Conversas ao vivo com os clientes. Assuma o ticket e responda por aqui.",
  issue: "Criar um login manualmente para um cliente, sem passar pelo pagamento.",
  legacy: "Clientes antigos (v4.5.7) que pagam a mensalidade de servidor de R$ 250.",
  external: "Quem pagou por fora (PIX direto). Aqui você estende o acesso na mão.",
  users: "Todas as contas cadastradas no site, com e-mail e data de criação.",
  licenses: "Todos os logins criados: ativos, vencendo, expirados e revogados.",
  orders: "Todas as compras: quem pagou, quanto, quando e se foi entregue.",
  market: "Produtos do Mercado: cadastrar, editar preço, imagem e ativar/desativar.",
  announcements: "Comunicados Corporativos: criar, editar e publicar avisos no dashboard dos clientes.",
  referrals: "Indicações e cashback: quem indicou quem e quanto tem a receber.",
  refunds: "Pedidos de reembolso. Você tem 2 dias para aprovar ou recusar cada um.",
  staff: "Quem é admin ou moderador. Cuidado: admin vê e altera tudo.",
  health: "Saúde do sistema: erros recentes, falhas de entrega e alertas.",
  logs: "Registro técnico do servidor, útil para investigar um problema específico.",
  audit: "Histórico de ações dos administradores, com data e responsável.",
  apk: "Bypass Play Protect (Fila APK): APKs enviados pelos clientes para bypass de Play Protect.",
  updates: "Publicar uma nova versão do app para os clientes baixarem.",
  tutorials: "Shadow Hub: Upload de vídeos, tutoriais e guias para novos usuários.",
  servers: "Troque a VPS de cada versão (4.5.7 / 4.6) e teste antes de vender.",
  selftest: "Teste automático de compra PIX de ponta a ponta, para conferir se está tudo ok.",
  quotas: "Controle de cotas da equipe: limites diários/mensais para geração de licenças manuais.",
  nexus: "Staff Nexus: canal de bate-papo interno e privado da equipe (admin, suporte e moderação).",
  academy: "Academia da Equipe: treinamento interno para novos integrantes (só admin, suporte e moderação).",
  vip: "Gestão do clube VIP: requisitos de cada tier, missões (padrão e VIP) e concessões de Bypass Play Protect.",
  trial_monitor: "Monitoramento em tempo real de trials: sucessos, bloqueios e falhas de provisionamento.",
  redeem: "Códigos de cortesia: gerar códigos de dias de licença ou renovação de servidor e reconciliar licenças com o painel Yaarsa.",
};



function AdminPage() {
  const [role, setRoleState] = useState<Role>("moderator");
  useEffect(() => {
    fetchMyRole()
      .then(setRoleState)
      .catch(() => {});
  }, []);
  const isAdminUser = role === "admin";
  const [tab, setTab] = useState<Tab>("overview");
  // Ficha 360º do cliente (aberta pela busca global Ctrl+K)
  const [customer360, setCustomer360] = useState<string | null>(null);
  const [navQuery, setNavQuery] = useState("");
  const [stats, setStats] = useState<{ users: number; licenses: number; revenue: number } | null>(
    null,
  );
  const [users, setUsers] = useState<any[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState("");

  const [orders, setOrders] = useState<any[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState<"todos" | "pendentes" | "pagos" | "falhos">(
    "todos",
  );
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [threadsOpenCount, setThreadsOpenCount] = useState(0);
  // Badge do chat = SÓ mensagens não lidas (estilo WhatsApp), não tickets abertos.
  const [threadsUnreadCount, setThreadsUnreadCount] = useState(0);
  // Badges "precisa de ação" por seção, em tempo real (Realtime + poll 30s).
  const { counts: sectionCounts, updatedAt: countsUpdatedAt } = useAdminSectionCounts(true);
  const navBadges: Record<string, number> = {
    chat: Math.max(threadsUnreadCount, sectionCounts.chat),
    orders: sectionCounts.orders,
    refunds: sectionCounts.refunds,
    apk: sectionCounts.apk,
  };
  const totalPending = navBadges.chat + navBadges.orders + navBadges.refunds + navBadges.apk;
  const [licenses, setLicenses] = useState<any[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [email, setEmail] = useState("");
  const [licKind, setLicKind] = useState<"all" | "trial" | "paid">("all");
  const [licStatus, setLicStatus] = useState<"all" | "active" | "expiring" | "expired" | "revoked">(
    "all",
  );
  const [licView, setLicView] = useState<"table" | "grouped">("table");
  const [licLimit, setLicLimit] = useState(50);
  const [licSearch, setLicSearch] = useState("");
  // Licenças vencidas/revogadas há mais de 3 dias somem do painel (arquivadas)
  // para não poluir. Se o cliente reativar, ela volta sozinha para a lista.
  const [licScope, setLicScope] = useState<"active" | "archived">("active");

  const statsFn = useServerFn(adminStats);
  const usersFn = useServerFn(adminListUsers);
  const ordersFn = useServerFn(adminListOrders);
  const licensesFn = useServerFn(adminListLicenses);
  const revokeFn = useServerFn(adminRevokeLicense);
  const extendFn = useServerFn(adminExtendLicense);
  const rolesFn = useServerFn(adminListRoles);
  const setRoleEmailFn = useServerFn(adminSetRoleByEmail);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);
  const setRoleFn = useServerFn(adminSetRole);
  const renewFn = useServerFn(adminRenewClientServer);
  const recreateFn = useServerFn(adminRecreateLicense);
  const fixBugFn = useServerFn(adminFixLoginBug);
  const analyzeBugFn = useServerFn(adminAnalyzeLoginBug);
  const [fixingLic, setFixingLic] = useState<string | null>(null);
  const [fixBugDialog, setFixBugDialog] = useState<{ open: boolean; licenseId: string | null }>({
    open: false,
    licenseId: null,
  });
  const [bugAnalysis, setBugAnalysis] = useState<{
    loading: boolean;
    diagnosis: string | null;
    factors: { label: string; value: string; alert: boolean }[] | null;
  }>({ loading: false, diagnosis: null, factors: null });
  const threadsCountFn = useServerFn(adminListThreads);

  // Track which lists have been loaded so realtime/polling don't refetch
  // datasets the admin never opened. Cuts admin cold-load from 5 parallel
  // fetches down to just stats+orders (used by the default Overview tab).
  const loadedRef = useRef<{ users: boolean; orders: boolean; licenses: boolean; roles: boolean }>({
    users: false,
    orders: false,
    licenses: false,
    roles: false,
  });
  const inflightRef = useRef<{
    [K in "stats" | "users" | "orders" | "licenses" | "roles"]?: Promise<any>;
  }>({});

  const loadThreadsCount = useCallback(() => {
    threadsCountFn({ data: { filter: "open" } })
      .then((t: any) => {
        const list = (t as any[]) ?? [];
        setThreadsOpenCount(list.length);
        setThreadsUnreadCount(list.filter((x) => Number(x?.unread_by_staff ?? 0) > 0).length);
      })
      .catch(() => {});
  }, [threadsCountFn]);

  const loadStats = useCallback(() => {
    if (inflightRef.current.stats) return inflightRef.current.stats;
    const p = statsFn()
      .then((r) => {
        setStats(r);
        return r;
      })
      .catch(() => {})
      .finally(() => {
        inflightRef.current.stats = undefined;
      });
    inflightRef.current.stats = p;
    return p;
  }, [statsFn]);
  const loadOrders = useCallback(() => {
    if (inflightRef.current.orders) return inflightRef.current.orders;
    const p = ordersFn()
      .then((r) => {
        setOrders(r);
        loadedRef.current.orders = true;
        return r;
      })
      .catch(() => {})
      .finally(() => {
        inflightRef.current.orders = undefined;
      });
    inflightRef.current.orders = p;
    return p;
  }, [ordersFn]);
  const loadUsers = useCallback(() => {
    if (inflightRef.current.users) return inflightRef.current.users;
    const p = usersFn()
      .then((r) => {
        setUsers(r);
        setUsersError(null);
        loadedRef.current.users = true;
        return r;
      })
      .catch((e: any) => {
        setUsersError(e?.message ?? "Falha ao carregar usuários");
      })
      .finally(() => {
        inflightRef.current.users = undefined;
      });
    inflightRef.current.users = p;
    return p;
  }, [usersFn]);

  const loadLicenses = useCallback(() => {
    if (inflightRef.current.licenses) return inflightRef.current.licenses;
    const p = licensesFn()
      .then((r) => {
        setLicenses(r);
        loadedRef.current.licenses = true;
        return r;
      })
      .catch(() => {})
      .finally(() => {
        inflightRef.current.licenses = undefined;
      });
    inflightRef.current.licenses = p;
    return p;
  }, [licensesFn]);
  const loadRoles = useCallback(() => {
    if (inflightRef.current.roles) return inflightRef.current.roles;
    const p = rolesFn()
      .then((r) => {
        setRoles(r as any);
        loadedRef.current.roles = true;
        return r;
      })
      .catch(() => {})
      .finally(() => {
        inflightRef.current.roles = undefined;
      });
    inflightRef.current.roles = p;
    return p;
  }, [rolesFn]);

  // Bootstrap: Overview needs stats + orders + licenças (para alertas de expiração).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    loadStats();
    loadOrders();
    loadLicenses();
    loadThreadsCount();

    // Debounced realtime → só refresca listas já carregadas.
    let t: any;
    const debounce = (fn: () => void) => {
      clearTimeout(t);
      t = setTimeout(fn, 500);
    };
    let statsCooldown = 0;
    const refreshStatsThrottled = () => {
      const now = Date.now();
      if (now - statsCooldown < 15000) return;
      statsCooldown = now;
      loadStats();
    };

    const ch = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "licenses" }, () =>
        debounce(() => {
          if (loadedRef.current.licenses) loadLicenses();
          refreshStatsThrottled();
        }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        debounce(() => {
          if (loadedRef.current.orders) loadOrders();
          refreshStatsThrottled();
        }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () =>
        debounce(() => {
          if (loadedRef.current.users) loadUsers();
          refreshStatsThrottled();
        }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () =>
        debounce(() => {
          if (loadedRef.current.roles) loadRoles();
        }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        const next = payload.new as any;
        if (!next.is_admin) {
          playNotifyDing();
          showDesktopNotification("Novo Ticket / Mensagem", next.body ?? "Um cliente enviada uma mensagem.");
        }
        debounce(() => {
          loadThreadsCount();
          // Se o admin estiver com uma thread aberta, as mensagens dela são recarregadas pelo componente interno ou via listRef
        });
      })
      .subscribe();

    const poll = setInterval(() => {
      loadStats();
      loadThreadsCount();
      if (loadedRef.current.orders) loadOrders();
      if (loadedRef.current.licenses) loadLicenses();
      if (loadedRef.current.users) loadUsers();
      if (loadedRef.current.roles) loadRoles();
    }, 60000); // Polling reduzido de 90s para 60s para maior precisão operacional.

    return () => {
      clearInterval(poll);
      clearTimeout(t);
      supabase.removeChannel(ch);
    };
  }, [loadStats, loadOrders, loadUsers, loadLicenses, loadRoles, loadThreadsCount]);

  // Lazy-load para as outras abas.
  useEffect(() => {
    if (tab === "users" || tab === "staff" || tab === "audit") {
      loadUsers();
      if (tab === "staff") loadRoles();
    }
    if (tab === "orders") loadOrders();
    if (tab === "licenses" || tab === "legacy" || tab === "audit" || tab === "issue")
      loadLicenses();
  }, [tab, loadUsers, loadRoles, loadOrders, loadLicenses]);

  async function revoke(id: string) {
    if (!confirm("Revogar esta licença?")) return;
    try {
      await revokeFn({ data: { licenseId: id } });
      toast.success("Revogada");
      setLicenses(await licensesFn());
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function extend(id: string) {
    const d = prompt("Nova data (YYYY-MM-DD)");
    if (!d) return;
    try {
      await extendFn({ data: { licenseId: id, newExpireDate: d } });
      toast.success("Estendida");
      setLicenses(await licensesFn());
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function renew(id: string) {
    if (!confirm("Renovar servidor deste cliente até o próximo dia 20?")) return;
    try {
      await renewFn({ data: { licenseId: id } });
      toast.success("Servidor renovado");
      setLicenses(await licensesFn());
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function recreate(id: string) {

    if (!confirm("Recriar credenciais do login? A senha anterior será substituída.")) return;
    try {
      const r: any = await recreateFn({ data: { licenseId: id } });
      toast.success(`Nova credencial: ${r.credentials.username} / ${r.credentials.password}`, {
        duration: 20000,
      });
      setLicenses(await licensesFn());
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  /** Abre o modal explicativo e dispara análise de IA com os fatores do caso. */
  function openFixLoginBug(id: string) {
    if (fixingLic) return;
    setBugAnalysis({ loading: true, diagnosis: null, factors: null });
    setFixBugDialog({ open: true, licenseId: id });
    analyzeBugFn({ data: { licenseId: id } })
      .then((r: any) =>
        setBugAnalysis({ loading: false, diagnosis: r.diagnosis, factors: r.factors }),
      )
      .catch((e: any) =>
        setBugAnalysis({
          loading: false,
          diagnosis: `Não foi possível gerar o diagnóstico automático: ${e.message}`,
          factors: [],
        }),
      );
  }
  /** Executa a correção: +1 dia, reaplica a mesma senha, volta a data. */
  async function confirmFixLoginBug() {
    const id = fixBugDialog.licenseId;
    if (!id || fixingLic) return;
    setFixBugDialog({ open: false, licenseId: null });
    setFixingLic(id);
    try {
      const r: any = await fixBugFn({ data: { licenseId: id } });
      toast.success(
        r.passwordReapplied
          ? `Login corrigido${r.expiresAt ? ` — validade mantida em ${r.expiresAt}` : ""}. Peça para o cliente fechar o BMob e entrar de novo.`
          : `Data reprocessada${r.expiresAt ? ` (validade ${r.expiresAt})` : ""}, mas o painel não aceitou reaplicar a senha. Se continuar com erro, use "Recriar credenciais".`,
        { duration: 12000 },
      );
      setLicenses(await licensesFn());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setFixingLic(null);
    }
  }
  async function setRole(userId: string, role: "admin" | "moderator" | "user") {
    const label = role === "admin" ? "Admin" : role === "moderator" ? "Suporte" : "Cliente";
    try {
      await setRoleFn({ data: { userId, role } });
      setRoles((await rolesFn()) as any);
      toast.success(`Cargo atualizado para ${label}`, {
        description:
          role === "user"
            ? undefined
            : "Peça para a pessoa sair e entrar de novo (F5) para o painel liberar os acessos.",
        duration: 8000,
      });
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível atualizar o cargo");
    }
  }

  async function setRoleByEmail(role: "admin" | "moderator" | "user") {
    const email = staffEmail.trim();
    if (!email || staffBusy) return;
    setStaffBusy(true);
    try {
      const r: any = await setRoleEmailFn({ data: { email, role } });
      setRoles((await rolesFn()) as any);
      setStaffEmail("");
      toast.success(
        `${r.email} agora é ${role === "admin" ? "Admin" : role === "moderator" ? "Suporte" : "Cliente"}`,
        {
          description: "Peça para a pessoa sair e entrar de novo (F5) para liberar as abas.",
          duration: 9000,
        },
      );
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível atualizar o cargo");
    } finally {
      setStaffBusy(false);
    }
  }

  const tabGroups: {
    title: string;
    accent: "neon" | "cyan" | "violet";
    items: { id: Tab; label: string; icon: any; hint?: string }[];
  }[] = [
    {
      title: "Operações",
      accent: "neon",
      items: [
        { id: "overview", label: "Visão Geral", icon: BarChart3, hint: "resumo executivo" },
        { id: "ia", label: "Shadow Ops IA", icon: Sparkles, hint: "diagnóstico automático" },
        { id: "chat", label: "Chat ao Vivo", icon: MessageSquare, hint: "responder clientes" },
        { id: "announcements", label: "Comunicados", icon: Megaphone, hint: "avisos corporativos" },
        { id: "apk", label: "Fila Play Protect", icon: Download, hint: "APKs pendentes" },
        { id: "updates", label: "Publicar Update", icon: Package, hint: "novos arquivos" },
        { id: "tutorials", label: "Shadow Hub", icon: Video, hint: "tutoriais & vídeos" },
        { id: "nexus", label: "Staff Nexus", icon: MessageSquare, hint: "chat interno da equipe" },
        { id: "academy", label: "Academia da Equipe", icon: GraduationCap, hint: "treinamento interno" },
      ],
    },
    {
      title: "Clientes & Licenças",
      accent: "cyan",
      items: [
        { id: "issue", label: "Emitir Licença", icon: UserPlus, hint: "criar login manual" },
        { id: "legacy", label: "Clientes Antigos", icon: History, hint: "R$ 250 servidor" },
        { id: "external", label: "Pagam Por Fora", icon: Wallet, hint: "extensão manual" },
        { id: "users", label: "Usuários", icon: Users },
        { id: "licenses", label: "Licenças", icon: KeyRound },
      ],
    },
    {
      title: "Financeiro",
      accent: "violet",
      items: [
        { id: "orders", label: "Pedidos", icon: DollarSign },
        { id: "market", label: "Mercado", icon: Store, hint: "produtos & catálogo" },
        { id: "referrals", label: "Indicações", icon: Gift, hint: "cashback / pix" },
        { id: "refunds", label: "Reembolsos", icon: RotateCcw, hint: "prazo 2 dias" },
      ],
    },
    {
      title: "Sistema",
      accent: "cyan",
      items: [
        { id: "staff", label: "Equipe", icon: ShieldCheck },
        { id: "health", label: "Monitoramento", icon: Activity, hint: "erros & regressões" },
        { id: "servers", label: "Servidores VPS", icon: Server, hint: "trocar VPS 4.5.7 / 4.6" },
        { id: "logs", label: "Logs do servidor", icon: ScrollText },
        { id: "audit", label: "Auditoria", icon: ShieldAlert },
        {
          id: "selftest",
          label: "Autoteste de Compra",
          icon: Activity,
          hint: "fluxo PIX ponta a ponta",
        },
        {
          id: "vip",
          label: "VIP & Missões",
          icon: Activity,
          hint: "tiers, missões e bypass",
        },
        {
          id: "trial_monitor",
          label: "Monitor de Trials",
          icon: Activity,
          hint: "sucessos & bloqueios",
        },
      ],
    },
  ];
  const visibleGroups = tabGroups
    .map((g) => ({ ...g, items: g.items.filter((t) => can(role, (SECTION_CAP as any)[t.id])) }))
    .filter((g) => g.items.length > 0);
  const allTabs = visibleGroups.flatMap((g) => g.items);
  const activeMeta = allTabs.find((t) => t.id === tab);
  const navTerm = navQuery.trim().toLowerCase();
  const filteredGroups = navTerm
    ? visibleGroups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (t) =>
              t.label.toLowerCase().includes(navTerm) ||
              (t.hint ?? "").toLowerCase().includes(navTerm) ||
              (TAB_DESC[t.id] ?? "").toLowerCase().includes(navTerm),
          ),
        }))
        .filter((g) => g.items.length > 0)
    : visibleGroups;
  const filteredTabs = filteredGroups.flatMap((g) => g.items);

  return (
    <div className="admin-enterprise min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1520px] overflow-x-hidden px-3 pb-24 pt-4 sm:px-5 sm:py-6 lg:pb-8">
        {/* HEADER BAR */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="enterprise-surface relative overflow-hidden p-5 sm:p-6"
        >
          {/* Subtle background glow */}
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/5 blur-[80px]" />
          
          <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">
                <Building2 className="h-3.5 w-3.5 text-primary" /> Mirror Executive Console
                <span className="hidden h-3 w-px bg-border/50 sm:inline-block" />
                <span
                  className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary"
                >
                  {ROLE_LABEL[role]}
                </span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Shadow Ops Command
              </h1>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                Strategic Assets & Infrastructure Management • v4.6.2-PRO
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-primary">
                  <Circle className="h-1.5 w-1.5 fill-primary text-primary animate-pulse" /> Operacional
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-cyan" />
                  <span className="max-w-[180px] truncate normal-case text-foreground/80 sm:max-w-none">
                    {email}
                  </span>
                </span>
                {totalPending > 0 && (
                  <motion.span 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-amber-400"
                  >
                    {totalPending} pendência{totalPending > 1 ? "s" : ""}
                  </motion.span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AdminGlobalSearch
                onSelectUser={(id) => setCustomer360(id)}
                onOpenThread={() => setTab("chat")}
              />
              <AdminTeamGuide onOpenSection={(id) => setTab(id as Tab)} />
              <Link to="/dashboard">
                <Button
                  size="sm"
                  variant="ghost"
                  className="font-mono text-[10px] uppercase tracking-wider transition-all hover:bg-primary/10 hover:text-primary"
                >
                  Meu Painel
                </Button>
              </Link>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void secureSignOut();
                }}
                className="font-mono text-[10px] uppercase tracking-wider hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" /> Sair
              </Button>
            </div>
          </div>
        </motion.div>

        {/* STATS */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <ExecStat
            icon={Users}
            label="Clientes cadastrados"
            value={stats ? String(stats.users) : "—"}
            sub="conta total"
            accent="cyan"
            code="TGT-001"
            delay={0.1}
          />
          <ExecStat
            icon={KeyRound}
            label="Licenças ativas"
            value={stats ? String(stats.licenses) : "—"}
            sub="em operação"
            accent="neon"
            code="LIC-002"
            delay={0.2}
          />
          <ExecStat
            icon={DollarSign}
            label="Receita bruta"
            value={stats ? formatBrl(stats.revenue) : "—"}
            sub="pedidos pagos"
            accent="violet"
            code="FIN-003"
            delay={0.3}
          />
          <ExecStat
            icon={Activity}
            label="Servidor"
            value="ONLINE"
            sub="uptime 99.9%"
            accent="neon"
            pulse
            code="OPS-004"
            delay={0.4}
          />
        </div>

        {/* GROUPED LAYOUT: sidebar (desktop) + content */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[232px_minmax(0,1fr)]">
          {/* SIDEBAR NAV */}
          <aside className="hidden lg:sticky lg:top-4 lg:block lg:self-start">
            {/* Desktop: grouped vertical nav */}
            <nav className="enterprise-surface hidden p-3 lg:block">
              <div className="mb-3 flex items-center justify-between px-2 pt-1 text-[10px] font-semibold uppercase text-muted-foreground">
                <span>Navegação</span>
                <span>{allTabs.length}</span>
              </div>

              <div className="mb-2.5">
                <input
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  placeholder="Buscar seção..."
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {filteredGroups.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  Nenhuma seção encontrada.
                </div>
              )}
              {filteredGroups.map((g, gi) => {
                const groupPending = g.items.reduce((s, t) => s + (navBadges[t.id] ?? 0), 0);
                return (
                  <div
                    key={g.title}
                    className={gi > 0 ? "mt-3 border-t border-border/40 pt-3" : ""}
                  >
                    <div
                      className="flex items-center gap-2 px-2 pb-1.5 text-[10px] font-semibold uppercase text-muted-foreground"
                    >
                      <span className="truncate opacity-80">{g.title}</span>
                      {groupPending > 0 && (
                        <span className="ml-auto rounded-full bg-foreground/10 px-1.5 py-px text-[8px] tracking-normal text-foreground/70">
                          {groupPending > 99 ? "99+" : groupPending}
                        </span>
                      )}
                    </div>
                    <div className="space-y-px">
                      {g.items.map((t) => {
                        const active = tab === t.id;
                        const isNew = t.id === "external";
                        const badge = navBadges[t.id] ?? 0;
                        return (
                          <motion.button
                            key={t.id}
                            whileHover={{ x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setTab(t.id)}
                            aria-current={active ? "page" : undefined}
                            className={`group relative flex w-full items-center gap-2.5 rounded-md py-2 pl-3 pr-2 text-left transition-colors ${
                              active
                                ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]"
                                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="admin-nav-active"
                                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                                className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary"
                              />
                            )}

                            <t.icon
                              className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className={`truncate text-xs ${active ? "font-semibold" : "font-medium"}`}
                                >
                                  {t.label}
                                </div>
                                {isNew && !active && (
                                  <span className="rounded bg-violet/20 px-1 py-px font-mono text-[8px] uppercase tracking-wider text-violet">
                                    novo
                                  </span>
                                )}
                              </div>
                              {t.hint && (
                                <div className="truncate text-[9px] text-muted-foreground/60">
                                  {t.hint}
                                </div>
                              )}
                            </div>
                            {badge > 0 && (
                              <span
                                title={`${badge} item(ns) aguardando ação`}
                                className={`grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 font-mono text-[9px] ${
                                  t.id === "chat" ? "bg-red-500 text-white" : "bg-neon/20 text-neon"
                                }`}
                              >
                                {badge > 99 ? "99+" : badge}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 border-t border-border/40 pt-2">
                <Link
                  to="/suporte"
                  search={{}}
                  className="flex items-center gap-2.5 rounded-md py-2 pl-3 pr-2 font-mono text-[11px] uppercase tracking-wider text-cyan transition-colors hover:bg-cyan/5"
                >
                  <LifeBuoy className="h-3.5 w-3.5" /> Ver Suporte
                </Link>
              </div>
            </nav>
          </aside>

          {/* CONTENT */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {isAdminUser && (
                  <AdminAlertsBanner
                    onOpenLogs={() => setTab("health")}
                    onOpenIA={() => setTab("ia")}
                  />
                )}

            {/* Section title bar */}
            {activeMeta && (
              <div className="sticky top-0 z-20 mb-4 -mx-3 border-b border-border bg-background/95 px-3 pb-3 pt-3 backdrop-blur sm:-mx-1 sm:px-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Administração /
                  </span>
                  <activeMeta.icon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    {activeMeta.label}
                  </h2>

                  {activeMeta.hint && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      · {activeMeta.hint}
                    </span>
                  )}
                  {(navBadges[tab] ?? 0) > 0 && (
                    <span className="rounded-full bg-neon/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neon">
                      {tab === "chat"
                        ? `${navBadges[tab]} não lida${navBadges[tab] > 1 ? "s" : ""}`
                        : `${navBadges[tab]} pendente${navBadges[tab] > 1 ? "s" : ""}`}
                    </span>
                  )}

                  <span
                    title={
                      countsUpdatedAt
                        ? `Atualizado ${new Date(countsUpdatedAt).toLocaleTimeString("pt-BR")}`
                        : "Sincronizando..."
                    }
                    className="ml-auto flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon" />
                    ao vivo{totalPending > 0 ? ` · ${totalPending}` : ""}
                  </span>
                </div>

                {TAB_DESC[tab] && (
                  <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                    {TAB_DESC[tab]}
                  </p>
                )}
              </div>
            )}

            {tab === "overview" &&
              (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const ordersToday = orders.filter((o) => new Date(o.created_at) >= today);
                const paidToday = ordersToday.filter((o) => o.status === "paid");
                const revenueToday = paidToday.reduce((s, o) => s + Number(o.amount || 0), 0);
                const pendingCount = orders.filter(
                  (o) => o.status !== "paid" && o.status !== "failed" && o.status !== "cancelled",
                ).length;
                const expSoon = licenses
                  .filter((l) => !l.is_trial && !l.disabled_at && !l.revoked && l.expires_at)
                  .map((l) => ({
                    l,
                    days: Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000),
                  }))
                  .filter((x) => x.days <= 5)
                  .sort((a, b) => a.days - b.days)
                  .slice(0, 6);
                const trialsActive = licenses.filter(
                  (l) =>
                    l.is_trial &&
                    !l.disabled_at &&
                    !l.revoked &&
                    (!l.expires_at || new Date(l.expires_at) > new Date()),
                ).length;
                const openTicketsCount = threadsOpenCount;
                const conversionRate =
                  ordersToday.length > 0
                    ? `${Math.round((paidToday.length / ordersToday.length) * 100)}%`
                    : "—";
                return (
                  <div className="space-y-4">
                    <AdminKpiCards
                      revenueToday={formatBrl(revenueToday)}
                      pendingOrders={pendingCount}
                      openTickets={openTicketsCount}
                      conversionRate={conversionRate}
                    />

                    {isAdminUser && <AdminDailyReport />}
                    {isAdminUser && (
                      <AdminActiveProblems onNavigate={(tab) => setTab(tab as Tab)} />
                    )}

                    {/* Mini strip: HOJE */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <MiniStat
                        label="Pedidos hoje"
                        value={String(ordersToday.length)}
                        accent="cyan"
                      />
                      <MiniStat label="Pagos hoje" value={String(paidToday.length)} accent="neon" />
                      <MiniStat
                        label="Receita hoje"
                        value={formatBrl(revenueToday)}
                        accent="violet"
                      />
                      <MiniStat label="Trials ativos" value={String(trialsActive)} accent="cyan" />
                    </div>

                    {/* Métricas 30 dias (financeiro: só admin) */}
                    {isAdminUser && <AdminMetricsPanel />}

                    {/* Saúde de envio de e-mails (rate limits / falhas) */}
                    {isAdminUser && <AdminEmailMetrics />}

                    {/* Antifraude: cadastros por conexão (hash de IP) */}
                    {isAdminUser && <AdminAntifraudPanel />}

                    {/* Tendência de receita */}
                    {isAdminUser && <RevenueSparkline orders={orders} />}

                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Pedidos recentes */}
                      <div className="terminal-card scanlines relative p-5 md:col-span-2">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-mono text-xs uppercase tracking-wider text-cyan">
                            // pedidos recentes
                          </h3>
                          <button
                            onClick={() => setTab("orders")}
                            className="font-mono text-[10px] uppercase text-muted-foreground hover:text-neon"
                          >
                            ver todos →
                          </button>
                        </div>
                        <div className="space-y-2">
                          {orders.slice(0, 8).map((o) => (
                            <div
                              key={o.id}
                              className="flex items-center justify-between gap-2 rounded border border-border/40 bg-background/40 px-3 py-2 font-mono text-xs"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${o.status === "paid" ? "bg-neon" : o.status === "failed" || o.status === "cancelled" ? "bg-danger" : "bg-amber-400"}`}
                                />
                                <span className="uppercase text-foreground/80">{o.plan_slug}</span>
                                {o.profile?.email && (
                                  <span className="truncate text-muted-foreground">
                                    · {o.profile.email}
                                  </span>
                                )}
                                {o.coupon_code && (
                                  <span className="shrink-0 rounded bg-violet/10 px-1.5 py-0.5 text-[9px] text-violet">
                                    {o.coupon_code}
                                  </span>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <span className="text-foreground">
                                  {formatBrl(Number(o.amount))}
                                </span>
                                <span className="text-muted-foreground">
                                  {new Date(o.created_at).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            </div>
                          ))}
                          {orders.length === 0 && (
                            <div className="py-8 text-center text-xs text-muted-foreground">
                              nenhum pedido ainda
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Atalhos */}
                      <div className="terminal-card scanlines relative p-5">
                        <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-violet">
                          // atalhos
                        </h3>
                        <div className="space-y-2">
                          <button
                            onClick={() => setTab("chat")}
                            className="flex w-full items-center gap-3 rounded border border-border/40 bg-background/40 p-3 text-left transition-colors hover:border-neon/40 hover:bg-neon/5"
                          >
                            <MessageSquare className="h-4 w-4 shrink-0 text-neon" />
                            <div className="min-w-0">
                              <div className="font-mono text-xs uppercase">Chat ao vivo</div>
                              <div className="text-[10px] text-muted-foreground">
                                Responder clientes
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => setTab("issue")}
                            className="flex w-full items-center gap-3 rounded border border-border/40 bg-background/40 p-3 text-left transition-colors hover:border-neon/40 hover:bg-neon/5"
                          >
                            <UserPlus className="h-4 w-4 shrink-0 text-neon" />
                            <div className="min-w-0">
                              <div className="font-mono text-xs uppercase">Emitir licença</div>
                              <div className="text-[10px] text-muted-foreground">
                                Criar login manual
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => setTab("external")}
                            className="flex w-full items-center gap-3 rounded border border-violet/40 bg-violet/5 p-3 text-left transition-colors hover:border-violet/60 hover:bg-violet/10"
                          >
                            <Wallet className="h-4 w-4 shrink-0 text-violet" />
                            <div className="min-w-0">
                              <div className="font-mono text-xs uppercase">Pagam por fora</div>
                              <div className="text-[10px] text-muted-foreground">
                                Migrar clientes antigos
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => setTab("servers")}
                            className="flex w-full items-center gap-3 rounded border border-border/40 bg-background/40 p-3 text-left transition-colors hover:border-neon/40 hover:bg-neon/5"
                          >
                            <Server className="h-4 w-4 shrink-0 text-neon" />
                            <div className="min-w-0">
                              <div className="font-mono text-xs uppercase">Servidores VPS</div>
                              <div className="text-[10px] text-muted-foreground">
                                Trocar VPS 4.5.7 / 4.6
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => setTab("apk")}
                            className="flex w-full items-center gap-3 rounded border border-border/40 bg-background/40 p-3 text-left transition-colors hover:border-cyan/40 hover:bg-cyan/5"
                          >
                            <Download className="h-4 w-4 shrink-0 text-cyan" />
                            <div className="min-w-0">
                              <div className="font-mono text-xs uppercase">Bypass Play Protect</div>
                              <div className="text-[10px] text-muted-foreground">
                                Fila Play Protect / Dropper
                              </div>
                             </div>
                           </button>
                           {isAdminUser && (
                             <button
                               onClick={() => setTab("quotas")}
                               className="flex w-full items-center gap-3 rounded border border-border/40 bg-background/40 p-3 text-left transition-colors hover:border-violet/40 hover:bg-violet/5"
                             >
                               <Settings2 className="h-4 w-4 shrink-0 text-violet" />
                               <div className="min-w-0">
                                 <div className="font-mono text-xs uppercase">Cotas Staff</div>
                                 <div className="text-[10px] text-muted-foreground">
                                   Limites para Suporte
                                 </div>
                               </div>
                             </button>
                           )}
                         </div>

                      </div>
                    </div>

                    {/* Painel de atenção: expirando + pendentes */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="terminal-card scanlines relative p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-amber-400">
                            <Bell className="h-3.5 w-3.5" /> licenças expirando (≤5d)
                          </h3>
                          <button
                            onClick={() => setTab("licenses")}
                            className="font-mono text-[10px] uppercase text-muted-foreground hover:text-neon"
                          >
                            gerir →
                          </button>
                        </div>
                        {expSoon.length === 0 ? (
                          <div className="rounded border border-dashed border-border/40 bg-background/30 py-6 text-center text-xs text-muted-foreground">
                            tudo certinho ✓
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {expSoon.map(({ l, days }) => (
                              <div
                                key={l.id}
                                className="flex items-center justify-between rounded border border-border/40 bg-background/40 px-3 py-2 font-mono text-xs"
                              >
                                <div className="min-w-0 truncate">
                                  <span className="text-foreground/80">{l.yaarsa_username}</span>
                                  <span className="text-muted-foreground"> · {l.yaarsa_email}</span>
                                </div>
                                <span
                                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ${days <= 2 ? "bg-danger/15 text-danger" : "bg-amber-400/15 text-amber-400"}`}
                                >
                                  {days <= 0 ? "vencida" : `${days}d`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="terminal-card scanlines relative p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-cyan">
                            <Activity className="h-3.5 w-3.5" /> pagamentos pendentes
                          </h3>
                          <span className="rounded bg-cyan/10 px-2 py-0.5 font-mono text-[10px] uppercase text-cyan">
                            {pendingCount}
                          </span>
                        </div>
                        {pendingCount === 0 ? (
                          <div className="rounded border border-dashed border-border/40 bg-background/30 py-6 text-center text-xs text-muted-foreground">
                            nenhum aguardando
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {orders
                              .filter(
                                (o) =>
                                  o.status !== "paid" &&
                                  o.status !== "failed" &&
                                  o.status !== "cancelled",
                              )
                              .slice(0, 6)
                              .map((o) => (
                                <div
                                  key={o.id}
                                  className="flex items-center justify-between rounded border border-border/40 bg-background/40 px-3 py-2 font-mono text-xs"
                                >
                                  <div className="min-w-0 truncate">
                                    <span className="text-foreground/80">{o.plan_slug}</span>
                                    {o.profile?.email && (
                                      <span className="text-muted-foreground">
                                        {" "}
                                        · {o.profile.email}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-foreground">
                                      {formatBrl(Number(o.amount))}
                                    </span>
                                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] uppercase text-amber-400">
                                      {o.status}
                                    </span>
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

            {tab === "chat" && <AdminSupportPanel />}
            {tab === "issue" && (
              <IssueLicensePanel
                onIssued={() =>
                  licensesFn()
                    .then(setLicenses)
                    .catch(() => {})
                }
              />
            )}
            {tab === "legacy" && (
              <LegacyClientsPanel
                licenses={licenses}
                onChanged={() =>
                  licensesFn()
                    .then(setLicenses)
                    .catch(() => {})
                }
              />
            )}
            {tab === "external" && <AdminExternalPayersPanel />}
            {tab === "quotas" && isAdminUser && <SupportQuotasPanel />}


            {tab === "users" && (
              <div className="space-y-4">
                {isAdminUser && <AdminTrialResetPanel />}
                <div className="terminal-card scanlines relative overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border/30 p-3">
                    <Input
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      placeholder="Filtrar por e-mail, apelido ou nome..."
                      className="h-9 max-w-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        loadedRef.current.users = false;
                        loadUsers();
                      }}
                    >
                      Recarregar
                    </Button>
                    <span className="font-mono text-xs text-muted-foreground">
                      {users.length} cadastrados
                    </span>
                  </div>
                  {usersError && (
                    <div className="border-b border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                      Erro ao carregar a lista: {usersError}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="border-b border-border/40 font-mono text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-3 text-left">Email</th>
                          <th className="p-3 text-left">Apelido / Nome</th>
                          <th className="p-3 text-left whitespace-nowrap">Criado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users
                          .filter((u) => {
                            const q = userFilter.trim().toLowerCase();
                            if (!q) return true;
                            return [u.email, u.display_name, u.full_name].some((v: any) =>
                              String(v ?? "")
                                .toLowerCase()
                                .includes(q),
                            );
                          })
                          .map((u) => (
                            <tr key={u.id} className="border-b border-border/20 hover:bg-neon/5">
                              <td className="p-3 break-all">{u.email}</td>
                              <td className="p-3 text-muted-foreground">
                                {u.display_name || u.full_name || "—"}
                              </td>
                              <td className="p-3 font-mono text-xs whitespace-nowrap">
                                {new Date(u.created_at).toLocaleString("pt-BR")}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!usersError && users.length === 0 && (
                      <p className="p-4 text-sm text-muted-foreground">
                        Nenhum usuário carregado ainda.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {tab === "orders" &&
              (() => {
                const q = orderSearch.trim().toLowerCase();
                const statusMap: Record<string, (o: any) => boolean> = {
                  todos: () => true,
                  pendentes: (o) =>
                    o.status !== "paid" && o.status !== "failed" && o.status !== "cancelled",
                  pagos: (o) => o.status === "paid",
                  falhos: (o) => o.status === "failed" || o.status === "cancelled",
                };
                const filteredOrders = orders.filter((o) => {
                  if (!statusMap[orderStatus](o)) return false;
                  if (!q) return true;
                  const hay =
                    `${o.plan_slug ?? ""} ${o.coupon_code ?? ""} ${o.profile?.email ?? ""} ${o.status ?? ""}`.toLowerCase();
                  return hay.includes(q);
                });
                const allVisibleSelected =
                  filteredOrders.length > 0 &&
                  filteredOrders.every((o) => selectedOrderIds.has(o.id));
                const toggleAll = () => {
                  setSelectedOrderIds((prev) => {
                    if (allVisibleSelected) return new Set();
                    return new Set(filteredOrders.map((o) => o.id));
                  });
                };
                const toggleOne = (id: string) => {
                  setSelectedOrderIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                };
                const bulkAction = (label: string) => toast(`${label}: em breve`);
                return (
                  <div className="space-y-3">
                    <div className="terminal-card scanlines relative flex flex-wrap items-center gap-2 p-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          placeholder="buscar por plano, email ou cupom..."
                          className="h-9 w-64 pl-8 font-mono text-xs"
                        />
                      </div>
                      <div className="flex gap-1">
                        {(["todos", "pendentes", "pagos", "falhos"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setOrderStatus(s)}
                            className={`rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                              orderStatus === s
                                ? "border-neon/50 bg-neon/10 text-neon"
                                : "border-border/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">
                        {filteredOrders.length} pedidos
                      </span>
                    </div>

                    {selectedOrderIds.size > 0 && (
                      <div className="flex flex-wrap items-center gap-2 rounded border border-neon/30 bg-neon/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
                        <span className="text-neon">{selectedOrderIds.size} selecionado(s)</span>
                        {isAdminUser && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 font-mono text-[10px] uppercase"
                              onClick={() => bulkAction("Marcar como pago")}
                            >
                              Marcar como pago
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 font-mono text-[10px] uppercase"
                              onClick={() => bulkAction("Reprocessar")}
                              title="Reprocessar os pagamentos do webhook para garantir que as licenças sejam criadas e apareçam no dashboard a partir das compras já feitas. faz isso so para verificar se ta tudo certo"
                            >
                              Reprocessar
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 font-mono text-[10px] uppercase"
                          onClick={() => bulkAction("Exportar CSV")}
                        >
                          Exportar CSV
                        </Button>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderIds(new Set())}
                          className="ml-auto text-muted-foreground hover:text-foreground"
                        >
                          limpar
                        </button>
                      </div>
                    )}

                    <div className="terminal-card scanlines relative overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                          <thead className="border-b border-border/40 font-mono text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="p-3 text-left">
                                <input
                                  type="checkbox"
                                  checked={allVisibleSelected}
                                  onChange={toggleAll}
                                />
                              </th>
                              <th className="p-3 text-left">Plano</th>
                              <th className="p-3 text-left">Valor</th>
                              <th className="p-3 text-left">Status</th>
                              <th className="p-3 text-left">Cupom</th>
                              <th className="p-3 text-left whitespace-nowrap">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOrders.map((o) => (
                              <tr key={o.id} className="border-b border-border/20 hover:bg-neon/5">
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedOrderIds.has(o.id)}
                                    onChange={() => toggleOne(o.id)}
                                  />
                                </td>
                                <td className="p-3 font-mono text-xs whitespace-nowrap">
                                  {o.plan_slug}
                                </td>
                                <td className="p-3 font-mono whitespace-nowrap">
                                  {formatBrl(Number(o.amount))}
                                </td>
                                <td
                                  className={`p-3 font-mono text-xs uppercase ${o.status === "paid" ? "text-neon" : "text-muted-foreground"}`}
                                >
                                  {o.status}
                                </td>
                                <td className="p-3 font-mono text-xs">{o.coupon_code || "—"}</td>
                                <td className="p-3 font-mono text-xs whitespace-nowrap">
                                  {new Date(o.created_at).toLocaleString("pt-BR")}
                                </td>
                              </tr>
                            ))}
                            {filteredOrders.length === 0 && (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="p-6 text-center text-xs text-muted-foreground"
                                >
                                  nenhum pedido encontrado
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            {tab === "licenses" &&
              (() => {
                const now = Date.now();
                const dayMs = 86400000;
                const bucketOf = (
                  l: any,
                ): { key: string; label: string; order: number; tone: string } => {
                  if (l.revoked)
                    return { key: "revoked", label: "Revogadas", order: 99, tone: "text-danger" };
                  if (!l.expires_at)
                    return {
                      key: "lifetime",
                      label: "Vitalícia / sem vencimento",
                      order: 90,
                      tone: "text-violet",
                    };
                  const diff = Math.floor((new Date(l.expires_at).getTime() - now) / dayMs);
                  if (diff < 0)
                    return { key: "expired", label: "Vencidas", order: 0, tone: "text-danger" };
                  if (diff <= 2)
                    return {
                      key: "d2",
                      label: "Vence em até 2 dias",
                      order: 1,
                      tone: "text-red-400",
                    };
                  if (diff <= 5)
                    return {
                      key: "d5",
                      label: "Vence em 3–5 dias",
                      order: 2,
                      tone: "text-amber-400",
                    };
                  if (diff <= 15)
                    return { key: "d15", label: "Vence em 6–15 dias", order: 3, tone: "text-cyan" };
                  if (diff <= 30)
                    return {
                      key: "d30",
                      label: "Vence em 16–30 dias",
                      order: 4,
                      tone: "text-neon",
                    };
                  return {
                    key: "d30plus",
                    label: "Vence em mais de 30 dias",
                    order: 5,
                    tone: "text-muted-foreground",
                  };
                };
                const statusOf = (l: any): "active" | "expiring" | "expired" | "revoked" => {
                  if (l.revoked) return "revoked";
                  if (!l.expires_at) return "active";
                  const diff = new Date(l.expires_at).getTime() - now;
                  if (diff < 0) return "expired";
                  if (diff <= 5 * dayMs) return "expiring";
                  return "active";
                };
                // "Arquivada": morta há mais de 3 dias (vencida ou revogada).
                // Se voltar a valer (cliente reativou / admin estendeu), sai do arquivo sozinha.
                const ARCHIVE_AFTER_DAYS = 3;
                const isArchived = (l: any): boolean => {
                  const s = statusOf(l);
                  if (s !== "expired" && s !== "revoked") return false;
                  const ref =
                    s === "expired"
                      ? new Date(l.expires_at).getTime()
                      : new Date(
                          l.server_overdue_at ??
                            l.disabled_at ??
                            l.updated_at ??
                            l.created_at ??
                            now,
                        ).getTime();
                  if (!Number.isFinite(ref)) return false;
                  return now - ref > ARCHIVE_AFTER_DAYS * dayMs;
                };
                const q = licSearch.trim().toLowerCase();
                const visibleBase = licenses.filter((l) =>
                  licScope === "active" ? !isArchived(l) : isArchived(l),
                );
                const archivedCount = licenses.filter(isArchived).length;
                const trialsCount = visibleBase.filter((l) => l.is_trial).length;
                const paidCount = visibleBase.length - trialsCount;
                const filtered = visibleBase.filter((l) => {
                  if (licKind === "trial" && !l.is_trial) return false;
                  if (licKind === "paid" && l.is_trial) return false;
                  if (licStatus !== "all" && statusOf(l) !== licStatus) return false;
                  if (q) {
                    const hay =
                      `${l.yaarsa_username ?? ""} ${l.yaarsa_email ?? ""} ${l.profile?.email ?? ""} ${l.profile?.full_name ?? ""} ${l.plan_slug ?? ""}`.toLowerCase();
                    if (!hay.includes(q)) return false;
                  }
                  return true;
                });
                const statusPill = (l: any) => {
                  const s = statusOf(l);
                  if (s === "revoked")
                    return (
                      <span className="inline-flex rounded border border-danger/50 bg-danger/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-danger">
                        revogada
                      </span>
                    );
                  if (s === "expired")
                    return (
                      <span className="inline-flex rounded border border-danger/50 bg-danger/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-danger">
                        vencida
                      </span>
                    );
                  if (s === "expiring")
                    return (
                      <span className="inline-flex rounded border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400">
                        expirando
                      </span>
                    );
                  return (
                    <span className="inline-flex rounded border border-neon/40 bg-neon/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-neon">
                      ativa
                    </span>
                  );
                };
                const expiresCell = (l: any) => {
                  if (!l.expires_at)
                    return <span className="text-muted-foreground">vitalícia</span>;
                  const d = new Date(l.expires_at);
                  const diff = Math.floor((d.getTime() - now) / dayMs);
                  const tone =
                    diff < 0
                      ? "text-danger"
                      : diff <= 2
                        ? "text-red-400"
                        : diff <= 5
                          ? "text-amber-400"
                          : diff <= 15
                            ? "text-cyan"
                            : "text-foreground";
                  const rel =
                    diff < 0 ? `${Math.abs(diff)}d atrás` : diff === 0 ? "hoje" : `em ${diff}d`;
                  return (
                    <div>
                      <div className={`font-mono text-xs ${tone}`}>
                        {d.toLocaleDateString("pt-BR")}
                      </div>
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">
                        {rel}
                      </div>
                    </div>
                  );
                };
                // Clientes com mais de uma licença viva — evita cobrança/atendimento duplicado.
                const liveByUser = new Map<string, number>();
                for (const l of licenses) {
                  const st = statusOf(l);
                  if (st === "expired" || st === "revoked") continue;
                  const k = l.profile?.email ?? l.user_id;
                  liveByUser.set(k, (liveByUser.get(k) ?? 0) + 1);
                }
                const renderRow = (l: any) => {
                  const st = statusOf(l);
                  const panel = panelOfLicense(l);
                  const fee =
                    Number(l.legacy_server_fee_brl) > 0
                      ? Number(l.legacy_server_fee_brl)
                      : l.is_legacy
                        ? 250
                        : 450;
                  const tierTone = panelTone(panel);
                  const dupCount = liveByUser.get(l.profile?.email ?? l.user_id) ?? 0;
                  const canFix = isAdminUser && st !== "revoked" && st !== "expired" && !l.is_trial;
                  return (
                    <tr key={l.id} className="border-b border-border/20 hover:bg-neon/5">
                      <td className="p-3 whitespace-nowrap">{expiresCell(l)}</td>
                      <td className="p-3 whitespace-nowrap">
                        {statusPill(l)}
                        {l.is_trial && (
                          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">
                            teste grátis
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-xs text-foreground">
                          {l.profile?.email ?? <span className="text-muted-foreground">—</span>}
                        </div>
                        {l.profile?.full_name && (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {l.profile.full_name}
                          </div>
                        )}
                        <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-cyan">
                          <span>login: {l.yaarsa_username}</span>
                          <button
                            type="button"
                            title="Copiar login"
                            onClick={() => {
                              navigator.clipboard
                                .writeText(String(l.yaarsa_username ?? ""))
                                .then(() => toast.success("Login copiado"))
                                .catch(() => toast.error("Não consegui copiar"));
                            }}
                            className="text-muted-foreground hover:text-cyan"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        {dupCount > 1 && (
                          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">
                            {dupCount} licenças ativas deste cliente
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-xs text-foreground">
                          {planLabel(l.plan_slug, l.is_trial)}
                        </div>
                        <div className={`font-mono text-[10px] uppercase ${tierTone}`}>
                          {licenseKindLabel(l)}
                        </div>
                        {l.is_legacy && (
                          <div className="font-mono text-[9px] uppercase text-cyan">
                            cliente antigo
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">
                        {l.is_trial ? (
                          <span className="text-muted-foreground">sem cobrança</span>
                        ) : (
                          <>
                            {formatBrl(fee)}
                            <span className="text-muted-foreground">/mês</span>
                            {l.paid_externally && (
                              <div className="font-mono text-[9px] uppercase text-cyan">
                                pago por fora
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {isAdminUser ? (
                          <div className="flex items-center justify-end gap-1">
                            {canFix && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={fixingLic === l.id}
                              title="Corrigir bug de erro (BMob): +1 dia, reaplica a senha e volta a data"
                              onClick={() => openFixLoginBug(l.id)}
                              className="h-7 gap-1 border-amber-400/60 px-2 font-mono text-[10px] uppercase tracking-wider text-amber-400 hover:bg-amber-400/10"
                            >
                              {fixingLic === l.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Wrench className="h-3 w-3" />
                              )}
                              Corrigir bug
                            </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Renovar servidor (próx. dia 20)"
                              onClick={() => renew(l.id)}
                            >
                              <RefreshCw className="h-3 w-3 text-cyan" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Recriar credenciais do login"
                              onClick={() => recreate(l.id)}
                            >
                              <RotateCw className="h-3 w-3 text-violet" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Estender manualmente"
                              onClick={() => extend(l.id)}
                            >
                              <Calendar className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Revogar"
                              onClick={() => revoke(l.id)}
                            >
                              <Ban className="h-3 w-3 text-danger" />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] uppercase text-muted-foreground">
                            somente leitura
                          </span>
                        )}
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
                      <th className="p-3 text-left whitespace-nowrap">Mensalidade</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                );
                type Group = {
                  key: string;
                  label: string;
                  order: number;
                  tone: string;
                  items: any[];
                };
                const groups: Group[] =
                  licView === "grouped"
                    ? Array.from(
                        filtered
                          .reduce<Map<string, Group>>((m, l) => {
                            const b = bucketOf(l);
                            if (!m.has(b.key)) m.set(b.key, { ...b, items: [] });
                            m.get(b.key)!.items.push(l);
                            return m;
                          }, new Map<string, Group>())
                          .values(),
                      ).sort((a, b) => a.order - b.order)
                    : [];
                groups.forEach((g) =>
                  g.items.sort(
                    (a: any, b: any) =>
                      new Date(a.expires_at ?? 0).getTime() - new Date(b.expires_at ?? 0).getTime(),
                  ),
                );

                const sortedFlat =
                  licView === "table"
                    ? [...filtered].sort((a, b) => {
                        const ax = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
                        const bx = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
                        return ax - bx;
                      })
                    : [];
                return (
                  <div className="terminal-card scanlines relative overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 p-3">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>
                          {filtered.length} de {visibleBase.length} · trials {trialsCount} · pagas{" "}
                          {paidCount}
                        </span>
                        <div className="flex overflow-hidden rounded border border-border/40 bg-background/40 font-mono text-[10px] uppercase tracking-wider">
                          {(
                            [
                              { k: "active", label: "Painel" },
                              { k: "archived", label: `Arquivadas · ${archivedCount}` },
                            ] as const
                          ).map((t) => (
                            <button
                              key={t.k}
                              onClick={() => setLicScope(t.k)}
                              className={`px-2 py-1 transition-colors ${licScope === t.k ? "bg-neon/15 text-neon" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={licSearch}
                          onChange={(e) => {
                            setLicSearch(e.target.value);
                            setLicLimit(50);
                          }}
                          placeholder="buscar email, login, plano…"
                          className="h-7 w-52 rounded border border-border/40 bg-background/40 px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-neon/60 focus:outline-none"
                        />
                        <div className="flex overflow-hidden rounded border border-border/40 bg-background/40 font-mono text-[10px] uppercase tracking-wider">
                          {(
                            [
                              { k: "all", label: "todas" },
                              { k: "active", label: "ativas" },
                              { k: "expiring", label: "expirando" },
                              { k: "expired", label: "vencidas" },
                              { k: "revoked", label: "revogadas" },
                            ] as const
                          ).map((t) => (
                            <button
                              key={t.k}
                              onClick={() => setLicStatus(t.k)}
                              className={`px-2 py-1 transition-colors ${licStatus === t.k ? "bg-neon/15 text-neon" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex overflow-hidden rounded border border-border/40 bg-background/40 font-mono text-[10px] uppercase tracking-wider">
                          {(
                            [
                              { k: "all", label: "todos" },
                              { k: "trial", label: `trials · ${trialsCount}` },
                              { k: "paid", label: `pagas · ${paidCount}` },
                            ] as const
                          ).map((t) => (
                            <button
                              key={t.k}
                              onClick={() => setLicKind(t.k)}
                              className={`px-2 py-1 transition-colors ${licKind === t.k ? "bg-neon/15 text-neon" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex overflow-hidden rounded border border-border/40 bg-background/40 font-mono text-[10px] uppercase tracking-wider">
                          {(
                            [
                              { k: "table", label: "tabela" },
                              { k: "grouped", label: "por vencimento" },
                            ] as const
                          ).map((t) => (
                            <button
                              key={t.k}
                              onClick={() => setLicView(t.k)}
                              className={`px-2 py-1 transition-colors ${licView === t.k ? "bg-violet/15 text-violet" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {licScope === "archived" && (
                        <div className="w-full rounded border border-danger/30 bg-danger/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-danger">
                          Licenças vencidas/revogadas há mais de 3 dias. Se reativadas, voltam ao
                          painel automaticamente.
                        </div>
                      )}
                    </div>
                    {licView === "table" ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px] text-sm">
                          {headerRow}
                          <tbody>{sortedFlat.slice(0, licLimit).map(renderRow)}</tbody>
                        </table>
                        {sortedFlat.length > licLimit && (
                          <div className="border-t border-border/30 p-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLicLimit((n) => n + 50)}
                              className="font-mono text-[10px] uppercase tracking-wider"
                            >
                              mostrar mais ({sortedFlat.length - licLimit} restantes)
                            </Button>
                          </div>
                        )}
                        {sortedFlat.length === 0 && (
                          <div className="p-6 text-center font-mono text-xs uppercase text-muted-foreground">
                            nenhuma licença corresponde ao filtro
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {groups.map((g) => (
                          <div key={g.key}>
                            <div className="flex items-center justify-between bg-background/40 px-3 py-2">
                              <div
                                className={`font-mono text-[11px] font-bold uppercase tracking-wider ${g.tone}`}
                              >
                                {g.label}
                              </div>
                              <div className="font-mono text-[10px] uppercase text-muted-foreground">
                                {g.items.length} licença{g.items.length === 1 ? "" : "s"}
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[960px] text-sm">
                                {headerRow}
                                <tbody>{g.items.map(renderRow)}</tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                        {groups.length === 0 && (
                          <div className="p-6 text-center font-mono text-xs uppercase text-muted-foreground">
                            nenhuma licença corresponde ao filtro
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            {tab === "staff" && (
              <div className="space-y-4">
                <AdminPermissionsMatrix />
                <div className="terminal-card scanlines relative overflow-hidden">
                  <div className="border-b border-border/40 p-3 font-mono text-xs uppercase text-muted-foreground">
                    <ShieldCheck className="mr-1 inline h-3 w-3 text-neon" /> Promova usuários para
                    admin ou suporte (moderator).
                  </div>
                  <div className="border-b border-border/40 bg-background/30 p-3">
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-cyan">
                      Promover pelo e-mail
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        placeholder="email@do-atendente.com"
                        className="min-w-[240px] flex-1 rounded border border-border/50 bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:border-cyan/60"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={staffBusy || !staffEmail.trim()}
                        onClick={() => setRoleByEmail("moderator")}
                      >
                        Tornar Suporte
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={staffBusy || !staffEmail.trim()}
                        onClick={() => setRoleByEmail("admin")}
                      >
                        Tornar Admin
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={staffBusy || !staffEmail.trim()}
                        onClick={() => setRoleByEmail("user")}
                      >
                        Rebaixar
                      </Button>
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                      // hoje nenhum atendente está como Suporte — por isso o time não enxerga o
                      Chat nem a Fila Play Protect.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="border-b border-border/40 font-mono text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-3 text-left">Email</th>
                          <th className="p-3 text-left">Cargo atual</th>
                          <th className="p-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => {
                          const current = roles.find((r) => r.user_id === u.id)?.role ?? "user";
                          return (
                            <tr key={u.id} className="border-b border-border/20">
                              <td className="p-3 break-all">{u.email}</td>
                              <td
                                className={`p-3 font-mono text-xs uppercase whitespace-nowrap ${current === "admin" ? "text-neon" : current === "moderator" ? "text-cyan" : "text-muted-foreground"}`}
                              >
                                {current}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={current === "admin"}
                                  onClick={() => setRole(u.id, "admin")}
                                >
                                  Admin
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={current === "moderator"}
                                  onClick={() => setRole(u.id, "moderator")}
                                >
                                  Suporte
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={current === "user"}
                                  onClick={() => setRole(u.id, "user")}
                                >
                                  Usuário
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === "referrals" && <ReferralsAdminPanel />}
            {tab === "health" && (
              <div className="space-y-6">
                <AdminHealthPanel onOpenLogs={() => setTab("logs")} />
                {role === "admin" && <AdminPanelServers />}
              </div>
            )}
            {tab === "servers" && role === "admin" && (
              <div className="space-y-6">
                <AdminPanelServers />
                <AdminMigrationWaves />
              </div>
            )}
            {tab === "logs" && <AdminLogsPanel />}
            {tab === "audit" && (
              <div className="space-y-4">
                <AdminAuditLog entries={demoAuditEntries(email)} />
                <AutoRevocationsPanel users={users} licenses={licenses} />
              </div>
            )}
            {tab === "ia" && <LicenseAiPanel />}
            {tab === "announcements" && <AdminAnnouncementsPanel />}
            {tab === "apk" && <AdminApkPanel />}
            {tab === "market" && <AdminMarketPanel />}
            {tab === "updates" && (
              <div className="space-y-6">
                <AdminUpdatesPanel />
                <AdminAnnouncementsPanel />
              </div>
            )}
            {tab === "tutorials" && <AdminTutorialsPanel />}
            {tab === "refunds" && <AdminRefundsPanel />}
              {tab === "selftest" && <AdminSelfTestPanel />}
              {tab === "trial_monitor" && <AdminTrialMonitorPanel />}
              {tab === "vip" && <AdminVipPanel />}
              {tab === "nexus" && <StaffNexusChat className="min-h-[560px]" />}
              {tab === "academy" && <StaffAcademyPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <AdminMobileNav
        groups={visibleGroups}
        primary={["overview", "chat", "orders", "licenses"]}
        tab={tab}
        onChange={(id) => setTab(id as Tab)}
        badges={navBadges}
      />

      <AdminCustomer360
        userId={customer360}
        onClose={() => setCustomer360(null)}
        onOpenThread={() => {
          setCustomer360(null);
          setTab("chat");
        }}
      />

      {/* Modal explicativo: Corrigir bug de login BMob */}
      <AlertDialog
        open={fixBugDialog.open}
        onOpenChange={(open) =>
          setFixBugDialog({ open, licenseId: open ? fixBugDialog.licenseId : null })
        }
      >
        <AlertDialogContent className="border-amber-400/30 bg-[#0b1220]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-400">
              <Wrench className="h-4 w-4" />
              Corrigir bug de login
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-muted-foreground">
              Use este recurso quando o cliente não conseguir logar na <strong>BTMob</strong> por
              erro de <em>e-mail/senha inválido</em>, ou quando a licença dele foi renovada no
              pagamento mas o painel não refletiu a nova data (ex.: pagou dia 20, mas o login não
              foi para o próximo dia 20).
              <br />
              <br />
              <span className="text-neon font-mono text-xs">O que será feito:</span>
              <ol className="mt-2 ml-4 list-decimal text-sm text-foreground space-y-1">
                <li>
                  Empurra a validade do login <strong>+1 dia</strong> no painel.
                </li>
                <li>
                  Reaplica a <strong>mesma senha atual</strong> do cliente (não gera nova).
                </li>
                <li>
                  Volta a data de vencimento para o <strong>dia original</strong>.
                </li>
              </ol>
              <br />
              Isso costuma resolver travamentos de sincronização entre o pagamento e o painel da
              BMob. O cliente deve fechar o app e tentar entrar novamente.
            </AlertDialogDescription>

            {/* Diagnóstico de IA */}
            <div className="mt-4 rounded border border-border/40 bg-[#0a0f18] p-3">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-neon">
                <Bot className="h-3.5 w-3.5" />
                Diagnóstico automático
              </div>
              {bugAnalysis.loading ? (
                <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando fatores da licença e histórico de integração...
                </div>
              ) : bugAnalysis.diagnosis ? (
                <div className="space-y-3">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {bugAnalysis.diagnosis}
                  </div>
                  {bugAnalysis.factors && bugAnalysis.factors.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {bugAnalysis.factors.map((f, idx) => (
                        <div
                          key={idx}
                          className={`rounded border p-2 ${f.alert ? "border-amber-400/40 bg-amber-400/10" : "border-border/30 bg-muted/20"}`}
                        >
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {f.label}
                          </div>
                          <div
                            className={`text-xs font-semibold ${f.alert ? "text-amber-400" : "text-foreground"}`}
                          >
                            {f.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Clique para abrir o caso e aguarde a análise.
                </div>
              )}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setFixBugDialog({ open: false, licenseId: null })}
              className="border-border/40 text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmFixLoginBug}
              disabled={fixingLic === fixBugDialog.licenseId}
              className="gap-2 bg-amber-500 text-black hover:bg-amber-400"
            >
              {fixingLic === fixBugDialog.licenseId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="h-4 w-4" />
              )}
              Confirmar correção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function exportLogsCsv(rows: any[], outcome: string) {
  const cols = [
    "created_at",
    "action",
    "endpoint_kind",
    "url",
    "attempt",
    "http_status",
    "latency_ms",
    "outcome",
    "error",
    "response_body",
    "payload",
    "context",
  ];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `server-logs${outcome ? `-${outcome}` : ""}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
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
      const r = await listFn({
        data: { source: "yaarsa", outcome: outcome || undefined, limit: 200 },
      });
      setRows(r as any[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [outcome]);

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
        <span className="font-mono text-xs uppercase tracking-wider text-cyan">
          // logs de integração do servidor
        </span>
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportLogsCsv(rows, outcome)}
            disabled={rows.length === 0}
            className="font-mono text-xs uppercase"
          >
            <Download className="h-3 w-3" />
            <span className="ml-1">CSV</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="font-mono text-xs uppercase"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
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
                    <td className="whitespace-nowrap p-2 text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-2 uppercase">{l.action || "—"}</td>
                    <td className="p-2">
                      <span className={l.endpoint_kind === "PROXY" ? "text-violet" : "text-cyan"}>
                        {l.endpoint_kind || "—"}
                      </span>
                      <div className="max-w-[280px] truncate text-[10px] text-muted-foreground">
                        {l.url}
                      </div>
                    </td>
                    <td className="p-2">{l.attempt ?? "—"}</td>
                    <td
                      className={`p-2 ${l.http_status && l.http_status >= 400 ? "text-danger" : l.http_status === 200 ? "text-neon" : ""}`}
                    >
                      {l.http_status ?? "—"}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {l.latency_ms ? `${l.latency_ms}ms` : "—"}
                    </td>
                    <td className={`p-2 uppercase ${outcomeColor(l.outcome)}`}>{l.outcome}</td>
                    <td className="max-w-[360px] p-2">
                      <div className="truncate text-danger/80">{l.error || ""}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {l.response_body || ""}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={l.id + "-d"} className="border-b border-border/40 bg-background/60">
                      <td colSpan={8} className="p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="mb-1 font-mono text-[10px] uppercase text-cyan">
                              // payload enviado
                            </div>
                            <pre className="max-h-64 overflow-auto rounded border border-border/40 bg-muted/50 p-2 font-mono text-[10px] text-foreground/80">
                              {JSON.stringify(l.payload, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="mb-1 font-mono text-[10px] uppercase text-cyan">
                              // resposta bruta
                            </div>
                            <pre className="max-h-64 overflow-auto rounded border border-border/40 bg-muted/50 p-2 font-mono text-[10px] text-foreground/80">
                              {l.response_body || "(vazio)"}
                            </pre>
                            {l.context && (
                              <>
                                <div className="mb-1 mt-2 font-mono text-[10px] uppercase text-violet">
                                  // contexto
                                </div>
                                <pre className="max-h-40 overflow-auto rounded border border-border/40 bg-muted/50 p-2 font-mono text-[10px] text-foreground/70">
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
              <tr>
                <td colSpan={8} className="p-8 text-center font-mono text-xs text-muted-foreground">
                  nenhum log ainda — dispare uma ação (trial, checkout, renovar) para gerar logs
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExecStat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  pulse,
  code,
  delay = 0,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  accent: "neon" | "cyan" | "violet";
  pulse?: boolean;
  code?: string;
  delay?: number;
}) {
  const color = accent === "neon" ? "text-neon" : accent === "cyan" ? "text-cyan" : "text-violet";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className="osint-panel osint-corners group relative overflow-hidden p-4 transition-colors hover:border-foreground/25"
    >
      <div
        className={`absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-50 ${color}`}
      />
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="truncate pl-2.5">{label}</span>
        <Icon className={`h-3.5 w-3.5 shrink-0 opacity-80 ${color}`} />
      </div>
      <div
        className={`mt-2.5 flex items-center gap-2 pl-2.5 font-mono text-[26px] leading-none font-bold tabular-nums ${color}`}
      >
        {pulse && <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-current" />}
        {value}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 pl-2.5 font-mono text-[10px] uppercase text-muted-foreground/60">
        <span className="truncate">{sub}</span>
        {code && <span className={`shrink-0 tracking-[0.18em] opacity-40 ${color}`}>{code}</span>}
      </div>
    </motion.div>
  );
}

function demoAuditEntries(adminEmail: string): AuditLogEntry[] {
  const now = Date.now();
  const fmt = (ms: number) => new Date(now - ms).toLocaleString("pt-BR");
  return [
    {
      id: "1",
      date: fmt(15 * 60000),
      admin: adminEmail || "admin",
      action: "Revogou licença",
      target: "cliente@exemplo.com",
      status: "sucesso",
    },
    {
      id: "2",
      date: fmt(90 * 60000),
      admin: adminEmail || "admin",
      action: "Estendeu licença",
      target: "usuario2@exemplo.com",
      status: "sucesso",
    },
    {
      id: "3",
      date: fmt(4 * 3600000),
      admin: "sistema",
      action: "Cron: revogação automática",
      target: "3 licenças vencidas",
      status: "sucesso",
    },
    {
      id: "4",
      date: fmt(26 * 3600000),
      admin: adminEmail || "admin",
      action: "Alterou cargo",
      target: "moderador@exemplo.com",
      status: "falha",
    },
  ];
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "neon" | "cyan" | "violet";
}) {
  const color = accent === "neon" ? "text-neon" : accent === "cyan" ? "text-cyan" : "text-violet";
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3 transition-colors hover:border-foreground/15">
      <div className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
        {label}
      </div>
      <div className={`mt-1.5 font-mono text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

// ============= LIVE CHAT PANEL =============
/** "há 3 min", "há 2 h", "há 4 d" — usado para SLA e cabeçalho da conversa. */
function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "—";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}
/** Rótulo do separador de dia dentro da conversa. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "hoje";
  if (same(d, yest)) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function priorityMeta(p?: string | null): { label: string; cls: string } | null {
  switch ((p ?? "").toLowerCase()) {
    case "urgent":
    case "urgente":
      return { label: "urgente", cls: "border-danger/50 bg-danger/10 text-danger" };
    case "high":
    case "alta":
      return { label: "alta", cls: "border-amber-400/50 bg-amber-400/10 text-amber-400" };
    case "low":
    case "baixa":
      return { label: "baixa", cls: "border-border/40 text-muted-foreground" };
    default:
      return null;
  }
}

type Thread = {
  id: string;
  user_id: string;
  subject: string;
  category?: string | null;
  priority?: string | null;
  status: string;
  updated_at: string;
  assigned_to?: string | null;
  assigned_name?: string | null;
  unread_by_staff?: number;
  last_customer_message_at?: string | null;
  profile: { email: string; full_name: string | null; display_name?: string | null } | null;
};
type Msg = {
  id: string;
  thread_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  is_admin: boolean;
  is_system?: boolean;
  created_at: string;
  sender_id: string;
  reply_to_id?: string | null;
};

/** Cache em memória por filtro: evita tela branca ao alternar abas/voltar pro chat. */
const threadsCache: Record<string, Thread[]> = {};

function isWaitingLong(t: Thread): boolean {
  const at = t.last_customer_message_at ? new Date(t.last_customer_message_at).getTime() : null;
  return t.status !== "closed" && at !== null && Date.now() - at > 30 * 60000;
}

/** Cards de pendências do suporte — clicáveis para filtrar a lista. */
function SupportOverviewCards({
  threads,
  loading,
  filter,
  onFilter,
  quick,
  onQuick,
}: {
  threads: Thread[];
  loading: boolean;
  filter: "open" | "mine" | "closed";
  onFilter: (f: "open" | "mine" | "closed") => void;
  quick: "all" | "unread" | "waiting" | "unassigned";
  onQuick: (q: "all" | "unread" | "waiting" | "unassigned") => void;
}) {
  const unread = threads.filter((t) => Number(t.unread_by_staff ?? 0) > 0).length;
  const waiting = threads.filter(isWaitingLong).length;
  const unassigned = threads.filter((t) => t.status !== "closed" && !t.assigned_to).length;

  const cards = [
    {
      key: "all" as const,
      label: "conversas",
      hint: filter === "closed" ? "encerradas" : filter === "mine" ? "minhas" : "abertas",
      value: threads.length,
      tone: "text-foreground",
      ring: "border-border/40",
    },
    {
      key: "unread" as const,
      label: "não lidas",
      hint: "aguardando leitura",
      value: unread,
      tone: "text-neon",
      ring: unread ? "border-neon/50 bg-neon/5" : "border-border/40",
    },
    {
      key: "waiting" as const,
      label: "sem resposta",
      hint: "cliente esperando +30 min",
      value: waiting,
      tone: "text-danger",
      ring: waiting ? "border-danger/50 bg-danger/5" : "border-border/40",
    },
    {
      key: "unassigned" as const,
      label: "sem responsável",
      hint: "ninguém assumiu",
      value: unassigned,
      tone: "text-cyan",
      ring: unassigned ? "border-cyan/50 bg-cyan/5" : "border-border/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {cards.map((c) => {
        const active = quick === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              if (c.key !== "all" && filter === "closed") onFilter("open");
              onQuick(active ? "all" : c.key);
            }}
            className={`terminal-card rounded-lg border p-3 text-left transition-colors ${c.ring} ${active ? "ring-1 ring-neon/60" : "hover:border-neon/40"}`}
          >
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {c.label}
            </div>
            <div className={`mt-1 font-mono text-2xl font-bold leading-none ${c.tone}`}>
              {loading ? (
                <span className="inline-block h-6 w-8 animate-pulse rounded bg-muted/50" />
              ) : (
                c.value
              )}
            </div>
            <div className="mt-1 truncate font-mono text-[9px] text-muted-foreground/70">
              {c.hint}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AdminChatPanel() {
  const [threads, setThreads] = useState<Thread[]>(() => threadsCache["open"] ?? []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fichaUser, setFichaUser] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatHasMore, setChatHasMore] = useState(false);
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(() => !threadsCache["open"]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "mine" | "closed">("open");
  const [quick, setQuick] = useState<"all" | "unread" | "waiting" | "unassigned">("all");
  // Default sound preference when nothing is stored yet.
  const SOUND_DEFAULT_ON = true;
  const [soundOn, setSoundOn] = useState<boolean>(SOUND_DEFAULT_ON);
  const [soundHydrated, setSoundHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
    } catch {
      /* ignore */
    }
    setSoundHydrated(true);
  }, []);
  useEffect(() => {
    soundOnRef.current = soundOn;
    if (!soundHydrated) return;
    try {
      localStorage.setItem("admin.chat.sound", soundOn ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, [soundOn, soundHydrated]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const adminFileRef = useRef<HTMLInputElement>(null);
  const threadsFn = useServerFn(adminListThreads);
  const msgsFn = useServerFn(adminListThreadMessages);
  const sendFn = useServerFn(adminSendMessage);
  const assumeFn = useServerFn(adminAssumeThread);
  const closeFn = useServerFn(adminCloseThread);

  const refreshThreads = () =>
    threadsFn({ data: { filter } })
      .then((t) => {
        threadsCache[filter] = t as Thread[];
        setThreads(t as Thread[]);
        setLoadError(null);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    requestNotifyPermission();
    // Mostra imediatamente o que já está em cache; só exibe skeleton na 1ª carga.
    const cached = threadsCache[filter];
    if (cached) {
      setThreads(cached);
      setLoading(false);
    } else {
      setThreads([]);
      setLoading(true);
    }
    let alive = true;
    threadsFn({ data: { filter } })
      .then((t) => {
        if (!alive) return;
        threadsCache[filter] = t as Thread[];
        setThreads(t as Thread[]);
        setLoadError(null);
        setLoading(false);
        // Em telas pequenas mostramos a lista primeiro (master-detail)
        const isDesktop =
          typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
        if (isDesktop && (t as Thread[]).length && !activeIdRef.current)
          setActiveId((t as Thread[])[0].id);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });

    // Realtime com coalescência: várias mensagens seguidas = 1 refetch.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        threadsFn({ data: { filter } })
          .then((t) => {
            if (!alive) return;
            threadsCache[filter] = t as Thread[];
            setThreads(t as Thread[]);
          })
          .catch(() => {});
      }, 600);
    };
    const ch = supabase
      .channel(`admin-threads-${filter}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const msg = payload.new as Msg;
          scheduleRefresh();
          if (
            !msg.is_admin &&
            soundOnRef.current &&
            new Date(msg.created_at).getTime() >= bootAtRef.current
          ) {
            playNotifyDing();
            if (document.hidden || msg.thread_id !== activeIdRef.current) {
              showDesktopNotification(
                "Nova mensagem no suporte",
                (msg.body ?? "[anexo]").slice(0, 140),
              );
            }
          }
        },
      )
      .subscribe();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (!activeId) return;
    setMsgs([]);
    setChatHasMore(false);
    msgsFn({ data: { threadId: activeId, limit: 30 } })
      .then((r: any) => {
        setMsgs((r?.messages ?? []) as Msg[]);
        setChatHasMore(!!r?.hasMore);
      })
      .catch(() => {});
    const ch = supabase
      .channel(`admin-t-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `thread_id=eq.${activeId}`,
        },
        (payload) =>
          setMsgs((prev) => {
            const next = payload.new as Msg;
            if (prev.some((x) => x.id === next.id)) return prev;
            return [...prev, next];
          }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [activeId, msgsFn]);

  async function loadOlderAdmin() {
    if (!activeId || chatLoadingOlder || !chatHasMore || msgs.length === 0) return;
    setChatLoadingOlder(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const r: any = await msgsFn({
        data: { threadId: activeId, limit: 30, before: msgs[0].created_at },
      });
      const older = (r?.messages ?? []) as Msg[];
      setChatHasMore(!!r?.hasMore);
      if (older.length) {
        setMsgs((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...older.filter((m) => !seen.has(m.id)), ...prev];
        });
        requestAnimationFrame(() => {
          const node = listRef.current;
          if (node) node.scrollTop = node.scrollHeight - prevHeight;
        });
      }
    } catch {
      /* silencioso */
    }
    setChatLoadingOlder(false);
  }

  const lastMsgId = msgs.length ? msgs[msgs.length - 1].id : "";
  useEffect(() => {
    if (chatLoadingOlder) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMsgId]);
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    setReplyTo(null);
  }, [activeId]);

  /** Rola até a mensagem citada e destaca por 1.5s (estilo WhatsApp). */
  function jumpToMessage(id: string) {
    const node = document.getElementById(`admin-msg-${id}`);
    if (!node) {
      toast.info("Mensagem original está em um trecho antigo — carregue mensagens antigas.");
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1500);
  }

  async function sendAttachment(file: File) {
    if (!activeId) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 20MB).");
      return;
    }
    setSending(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `staff/${activeId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("support-media")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) {
        throw new Error(
          /row-level security|not authorized/i.test(upErr.message)
            ? "Sem permissão para enviar anexos (verifique seu cargo de equipe)."
            : `Falha no upload do anexo: ${upErr.message}`,
        );
      }
      const res: any = await sendFn({
        data: {
          threadId: activeId,
          body: body.trim() || undefined,
          attachmentPath: path,
          attachmentType: file.type || "application/octet-stream",
          replyToId: replyTo?.id ?? null,
        },
      });
      setBody("");
      setReplyTo(null);
      if (res?.id)
        setMsgs((prev) => (prev.some((x) => x.id === res.id) ? prev : [...prev, res as Msg]));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar anexo");
    }
    setSending(false);
  }

  async function send() {
    if (!activeId || !body.trim()) return;
    unlockNotifySound();
    setSending(true);
    try {
      const res: any = await sendFn({
        data: { threadId: activeId, body: body.trim(), replyToId: replyTo?.id ?? null },
      });
      setBody("");
      setReplyTo(null);
      if (res?.id)
        setMsgs((prev) => (prev.some((x) => x.id === res.id) ? prev : [...prev, res as Msg]));
    } catch (e: any) {
      toast.error(e.message);
    }
    setSending(false);
    inputRef.current?.focus({ preventScroll: true });
  }

  const filtered = threads.filter((t) => {
    if (quick === "unread" && !(Number(t.unread_by_staff ?? 0) > 0)) return false;
    if (quick === "waiting" && !isWaitingLong(t)) return false;
    if (quick === "unassigned" && (t.status === "closed" || t.assigned_to)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (t.profile?.email ?? "").toLowerCase().includes(q) ||
      (t.profile?.display_name ?? "").toLowerCase().includes(q) ||
      (t.profile?.full_name ?? "").toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
    );
  });

  const activeThread = threads.find((t) => t.id === activeId);

  return (
    <div className="space-y-3">
      <SupportOverviewCards
        threads={threads}
        loading={loading}
        filter={filter}
        onFilter={setFilter}
        quick={quick}
        onQuick={setQuick}
      />
      <div className="terminal-card scanlines relative grid h-[calc(100dvh-12rem)] grid-cols-1 overflow-hidden md:h-[70vh] md:grid-cols-[320px_1fr]">
        {/* Thread list */}
        <aside
          className={`${activeId ? "hidden md:flex" : "flex"} min-h-0 flex-col border-b border-border/40 md:border-b-0 md:border-r`}
        >
          <div className="border-b border-border/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-neon">
                <MessageSquare className="h-3.5 w-3.5" /> conversas
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    unlockNotifySound();
                    setSoundOn((s) => !s);
                    if (!soundOn) playNotifyDing();
                  }}
                  title={soundOn ? "Silenciar notificações" : "Ativar som de notificação"}
                  aria-hidden={!soundHydrated}
                  className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-opacity ${soundHydrated ? "opacity-100" : "opacity-0 pointer-events-none"} ${soundOn ? "border-neon/40 bg-neon/5 text-neon" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
                >
                  {soundOn ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                </button>
                {(() => {
                  const unread = threads.reduce(
                    (n, t) => n + (Number(t.unread_by_staff ?? 0) > 0 ? 1 : 0),
                    0,
                  );
                  return (
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                      {unread > 0 && (
                        <span
                          title={`${unread} conversa(s) com mensagem não lida`}
                          className="rounded-full bg-neon px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground"
                        >
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                      {threads.length}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="mb-2 flex gap-1">
              {(["open", "mine", "closed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex-1 rounded px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${filter === f ? "border border-neon/50 bg-neon/10 text-neon" : "border border-border/30 text-muted-foreground hover:text-foreground"}`}
                >
                  {f === "open" ? "abertas" : f === "mine" ? "minhas" : "encerradas"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="buscar cliente..."
                className="h-8 pl-8 font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted/50" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-2.5 w-2/3 animate-pulse rounded bg-muted/50" />
                      <div className="h-2 w-1/2 animate-pulse rounded bg-muted/30" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && loadError && (
              <div className="m-3 rounded border border-destructive/40 bg-destructive/10 p-3 text-xs">
                <div className="font-mono font-bold text-destructive">
                  falha ao carregar conversas
                </div>
                <div className="mt-1 break-words text-muted-foreground">{loadError}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-[11px]"
                  onClick={() => {
                    setLoading(true);
                    refreshThreads().finally(() => setLoading(false));
                  }}
                >
                  tentar novamente
                </Button>
              </div>
            )}
            {!loading && !loadError && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <MessageSquare className="h-7 w-7 text-neon/40" />
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {quick !== "all"
                    ? "nenhuma conversa nesse indicador"
                    : query
                      ? "nenhum cliente com esse termo"
                      : filter === "open"
                        ? "nenhuma conversa aberta"
                        : filter === "mine"
                          ? "você não assumiu nenhum ticket"
                          : "nenhuma conversa encerrada"}
                </div>
                {quick !== "all" && (
                  <button
                    type="button"
                    onClick={() => setQuick("all")}
                    className="font-mono text-[10px] uppercase text-neon hover:underline"
                  >
                    limpar filtro →
                  </button>
                )}
                {quick === "all" && !query && filter !== "open" && (
                  <button
                    type="button"
                    onClick={() => setFilter("open")}
                    className="font-mono text-[10px] uppercase text-neon hover:underline"
                  >
                    ver abertas →
                  </button>
                )}
              </div>
            )}
            {filtered.map((t) => {
              const active = t.id === activeId;
              const lastCustomerAt = t.last_customer_message_at
                ? new Date(t.last_customer_message_at).getTime()
                : null;
              const waitingLong =
                t.status !== "closed" &&
                lastCustomerAt !== null &&
                Date.now() - lastCustomerAt > 30 * 60000;
              return (
                <div
                  key={t.id}
                  className={`group flex w-full items-center gap-3 border-b border-border/20 p-3 text-left transition-colors ${active ? "bg-neon/10" : "hover:bg-neon/5"}`}
                >
                  <button
                    onClick={() => setActiveId(t.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div
                      className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${active ? "bg-neon text-primary-foreground" : "bg-muted text-foreground"}`}
                    >
                      {(t.profile?.display_name || t.profile?.email || "?")
                        .slice(0, 2)
                        .toUpperCase()}
                      {waitingLong && (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-background bg-danger"
                          title="Aguardando há mais de 30 min"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="flex-shrink-0" aria-hidden>
                            {categoryMeta(t.category).emoji}
                          </span>
                          <span className="truncate font-mono text-xs text-foreground">
                            {t.profile?.display_name || t.profile?.email || "cliente"}
                          </span>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <span className="font-mono text-[9px] uppercase text-muted-foreground">
                            {timeAgo(t.last_customer_message_at ?? t.updated_at)}
                          </span>
                          {(t.unread_by_staff ?? 0) > 0 && !active && (
                            <span className="rounded-full bg-neon px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary-foreground">
                              {t.unread_by_staff}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                        {t.subject}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${t.status === "closed" ? "bg-muted/40 text-muted-foreground" : t.status === "assigned" ? "bg-cyan/10 text-cyan" : "bg-neon/10 text-neon"}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${t.status === "closed" ? "bg-muted-foreground" : t.status === "assigned" ? "bg-cyan" : "bg-neon"}`}
                          />
                          {t.status === "assigned" && t.assigned_name
                            ? t.assigned_name
                            : t.status === "closed"
                              ? "encerrado"
                              : "aberto"}
                        </span>
                        <span className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                          {categoryMeta(t.category).label}
                        </span>
                        {priorityMeta(t.priority) && (
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${priorityMeta(t.priority)!.cls}`}
                          >
                            {priorityMeta(t.priority)!.label}
                          </span>
                        )}
                        {waitingLong && (
                          <span className="rounded bg-danger/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-danger">
                            aguardando
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  {t.status !== "closed" && !t.assigned_to && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await assumeFn({ data: { threadId: t.id } });
                          await refreshThreads();
                          toast.success("Ticket assumido");
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                      title="Assumir ticket"
                      className="shrink-0 rounded border border-neon/40 bg-neon/5 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-neon opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      Assumir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Chat area */}
        <section className={`${activeId ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>
          {!activeThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 text-neon/50" />
              <div className="font-mono text-xs uppercase tracking-wider">
                Selecione uma conversa
              </div>
              <div className="max-w-xs font-mono text-[10px] leading-relaxed text-muted-foreground/70">
                assuma o ticket para o cliente ver quem está atendendo · encerre quando resolver —
                uma nova mensagem dele abre outro ticket
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-background/30 px-3 py-2 md:px-4 md:py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    aria-label="Voltar para a lista de conversas"
                    className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded text-muted-foreground hover:bg-background/40 hover:text-foreground md:hidden"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-neon/30 bg-neon/10 font-mono text-xs font-bold text-neon sm:grid">
                    {(activeThread.profile?.display_name || activeThread.profile?.email || "?")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm">
                        {activeThread.profile?.display_name ||
                          activeThread.profile?.email ||
                          "cliente"}
                      </span>
                      {activeThread.profile?.email && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(activeThread.profile?.email ?? "");
                            toast.success("Email copiado");
                          }}
                          title="Copiar email"
                          className="rounded p-1 text-muted-foreground hover:bg-background/40 hover:text-neon"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                      <span className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                        {categoryMeta(activeThread.category).emoji}{" "}
                        {categoryMeta(activeThread.category).label}
                      </span>
                      {priorityMeta(activeThread.priority) && (
                        <span
                          className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${priorityMeta(activeThread.priority)!.cls}`}
                        >
                          {priorityMeta(activeThread.priority)!.label}
                        </span>
                      )}
                    </div>
                    <div className="truncate font-mono text-[10px] uppercase text-muted-foreground">
                      {activeThread.subject}
                      {activeThread.assigned_name &&
                        ` · atendido por ${activeThread.assigned_name}`}
                      {activeThread.status === "closed"
                        ? " · ENCERRADO"
                        : ` · última msg do cliente ${timeAgo(activeThread.last_customer_message_at ?? activeThread.updated_at)}`}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeThread.status !== "closed" && !activeThread.assigned_to && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await assumeFn({ data: { threadId: activeThread.id } });
                          await refreshThreads();
                          toast.success("Conversa assumida");
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      className="h-7 font-mono text-[10px] uppercase"
                    >
                      Assumir
                    </Button>
                  )}
                  {activeThread.status !== "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (
                          !confirm(
                            "Encerrar esta conversa? O cliente vê o histórico e uma nova mensagem abre outro ticket.",
                          )
                        )
                          return;
                        try {
                          await closeFn({ data: { threadId: activeThread.id } });
                          await refreshThreads();
                          toast.success("Conversa encerrada");
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      className="h-7 font-mono text-[10px] uppercase text-destructive"
                    >
                      Encerrar
                    </Button>
                  )}
                  <IssueInThreadButton
                    threadId={activeThread.id}
                    defaultEmail={activeThread.profile?.email ?? ""}
                  />
                  <div className="flex items-center gap-2 rounded border border-neon/30 bg-neon/5 px-2 py-1 font-mono text-[10px] uppercase text-neon">
                    <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-neon" /> ao
                    vivo
                  </div>
                  {/* Botão de Correção via IA para o Admin forçar o gatilho */}
                  {activeThread.status !== "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      title="Forçar correção automática de login para este cliente"
                      onClick={() => {
                        adminSendMessage({ 
                          data: { 
                            threadId: activeThread.id, 
                            body: "Shadow IA: Iniciando procedimento de correção automática de login/licença para este cliente..." 
                          } 
                        }).catch(() => {});
                        toast.info("Gatilho de correção enviado");
                      }}
                      className="h-7 border-amber-400/40 bg-amber-400/10 font-mono text-[10px] uppercase text-amber-400 hover:bg-amber-400/20"
                    >
                      <Wrench className="h-3 w-3" /> Corrigir Bug
                    </Button>
                  )}
                </div>
              </div>
              <SupportCustomerContext
                key={activeThread.user_id}
                userId={activeThread.user_id}
                email={activeThread.profile?.email}
                onOpenFicha={() => setFichaUser(activeThread.user_id)}
              />
              <div
                ref={listRef}
                onScroll={() => {
                  const el = listRef.current;
                  if (el && el.scrollTop < 40) void loadOlderAdmin();
                }}
                className="flex-1 space-y-3 overflow-y-auto bg-background/30 p-4"
              >
                {(chatHasMore || chatLoadingOlder) && (
                  <div className="flex justify-center pb-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 text-[10px] font-mono uppercase tracking-wider"
                      disabled={chatLoadingOlder}
                      onClick={() => void loadOlderAdmin()}
                    >
                      {chatLoadingOlder ? "carregando..." : "carregar mensagens antigas"}
                    </Button>
                  </div>
                )}

                {msgs.length === 0 && (
                  <div className="flex flex-col items-center gap-2 pt-16 text-center">
                    <MessageSquare className="h-6 w-6 text-neon/40" />
                    <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      sem mensagens ainda
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground/70">
                      inicie a conversa com uma resposta rápida abaixo
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => {
                  const prev = i > 0 ? msgs[i - 1] : null;
                  const showDay =
                    !prev ||
                    new Date(prev.created_at).toDateString() !==
                      new Date(m.created_at).toDateString();
                  const sameSender =
                    !!prev && !prev.is_system && !m.is_system && prev.is_admin === m.is_admin;
                  const quoted = m.reply_to_id
                    ? (msgs.find((x) => x.id === m.reply_to_id) ?? null)
                    : null;
                  return (
                    <div key={m.id} className={showDay ? "space-y-3" : sameSender ? "!mt-1" : ""}>
                      {showDay && (
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-border/40" />
                          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                            {dayLabel(m.created_at)}
                          </span>
                          <div className="h-px flex-1 bg-border/40" />
                        </div>
                      )}
                      {m.is_system ? (
                        <div className="flex justify-center">
                          <div className="max-w-[80%] whitespace-pre-wrap rounded-full border border-cyan/30 bg-cyan/5 px-3 py-1 text-center font-mono text-[10px] text-cyan">
                            {m.body}
                          </div>
                        </div>
                      ) : (
                        <div
                          id={`admin-msg-${m.id}`}
                          className={`group flex items-end gap-1.5 ${m.is_admin ? "justify-end" : "justify-start"}`}
                        >
                          {m.is_admin && (
                            <button
                              type="button"
                              title="Responder esta mensagem"
                              onClick={() => {
                                setReplyTo(m);
                                inputRef.current?.focus({ preventScroll: true });
                              }}
                              className="mb-1 rounded-full border border-border/60 bg-background/80 p-1.5 text-muted-foreground opacity-0 transition hover:text-neon focus:opacity-100 group-hover:opacity-100"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <div
                            className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm transition-colors ${
                              m.is_admin
                                ? "rounded-br-sm border border-violet/40 bg-violet/10"
                                : "rounded-bl-sm border border-border bg-card"
                            } ${highlightId === m.id ? "ring-2 ring-neon/70" : ""}`}
                          >
                            {!sameSender && (
                              <div
                                className={`mb-1 font-mono text-[9px] uppercase tracking-wider ${m.is_admin ? "text-violet" : "text-neon"}`}
                              >
                                {m.is_admin
                                  ? activeThread.assigned_name
                                    ? `${activeThread.assigned_name} · suporte`
                                    : "suporte"
                                  : activeThread.profile?.display_name || "cliente"}
                              </div>
                            )}
                            {m.reply_to_id && (
                              <button
                                type="button"
                                onClick={() => jumpToMessage(m.reply_to_id!)}
                                className="mb-1.5 flex w-full gap-2 rounded-md border-l-2 border-neon/70 bg-background/60 px-2 py-1 text-left transition hover:bg-background/90"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block font-mono text-[9px] uppercase tracking-wider text-neon">
                                    {quoted
                                      ? quoted.is_admin
                                        ? "suporte"
                                        : activeThread.profile?.display_name || "cliente"
                                      : "mensagem citada"}
                                  </span>
                                  <span className="line-clamp-2 block text-[11px] text-muted-foreground">
                                    {quoted
                                      ? (quoted.body ?? "[anexo]")
                                      : "ver mensagem original"}
                                  </span>
                                </span>
                              </button>
                            )}
                            {m.body && (
                              <div className="whitespace-pre-wrap break-words leading-relaxed">
                                {m.body}
                              </div>
                            )}

                            {m.attachment_url &&
                              (m.attachment_type?.startsWith("image/") ? (
                                <img
                                  loading="lazy"
                                  src={m.attachment_url}
                                  alt="anexo"
                                  className="mt-2 max-h-64 rounded"
                                />
                              ) : m.attachment_type?.startsWith("video/") ? (
                                <video
                                  src={m.attachment_url}
                                  controls
                                  className="mt-2 max-h-64 rounded"
                                />
                              ) : (
                                <a
                                  href={m.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 block text-cyan underline"
                                >
                                  Baixar anexo
                                </a>
                              ))}
                            <div
                              className={`mt-1 font-mono text-[9px] text-muted-foreground ${m.is_admin ? "text-right" : ""}`}
                            >
                              {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                          {!m.is_admin && (
                            <button
                              type="button"
                              title="Responder esta mensagem"
                              onClick={() => {
                                setReplyTo(m);
                                inputRef.current?.focus({ preventScroll: true });
                              }}
                              className="mb-1 rounded-full border border-border/60 bg-background/80 p-1.5 text-muted-foreground opacity-0 transition hover:text-neon focus:opacity-100 group-hover:opacity-100"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border/40 bg-background/40 p-3">
                {replyTo && (
                  <div className="mb-2 flex items-start gap-2 rounded-md border-l-2 border-neon bg-muted/30 px-2.5 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-neon">
                        respondendo{" "}
                        {replyTo.is_admin
                          ? "suporte"
                          : activeThread.profile?.display_name || "cliente"}
                      </div>
                      <div className="line-clamp-2 text-[11px] text-muted-foreground">
                        {replyTo.body ?? "[anexo]"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="rounded p-1 text-muted-foreground transition hover:text-destructive"
                      title="Cancelar resposta"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    enter envia · shift+enter quebra linha
                    {body.length > 0 && ` · ${body.length} caracteres`}
                  </span>
                  <QuickRepliesDropdown
                    onPick={(text) => {
                      setBody((prev) => (prev.trim() ? `${prev}\n${text}` : text));
                      inputRef.current?.focus({ preventScroll: true });
                    }}
                  />
                </div>
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                >
                  <input
                    type="file"
                    ref={adminFileRef}
                    hidden
                    accept="image/*,application/pdf,video/mp4"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void sendAttachment(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={sending}
                    aria-label="Anexar arquivo"
                    title="Anexar imagem, PDF ou vídeo (máx 20MB)"
                    className="min-h-11 w-11 shrink-0"
                    onClick={() => adminFileRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <textarea
                    ref={inputRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={
                      activeThread.status === "closed"
                        ? "Conversa encerrada — responder reabre o atendimento"
                        : "Responder cliente..."
                    }
                    className="max-h-40 min-h-11 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-neon/60 focus:outline-none"
                  />
                  <Button
                    type="submit"
                    disabled={sending || !body.trim()}
                    aria-label="Enviar mensagem"
                    className="glow-neon min-h-11 shrink-0 px-3 font-mono uppercase tracking-wider sm:px-4"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 sm:mr-2" />
                        <span className="hidden sm:inline">Enviar</span>
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
      <AdminCustomer360
        userId={fichaUser}
        onClose={() => setFichaUser(null)}
        onOpenThread={(tid) => {
          setFichaUser(null);
          setActiveId(tid);
        }}
      />
    </div>
  );
}

// ============ Emitir licença (formulário completo) ============
function IssueLicensePanel({
  onIssued,
  initialEmail,
  initialThreadId,
  compact,
}: {
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

  const quotaFn = useServerFn(getMyQuota);
  const [quota, setQuota] = useState<any>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);

  const loadQuota = useCallback(async () => {
    try {
      const q = await quotaFn();
      setQuota(q);
    } catch {
      /* fallback */
    } finally {
      setLoadingQuota(false);
    }
  }, [quotaFn]);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);



  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("Informe o email do cliente");
    setBusy(true);
    setResult(null);
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
      toast.success(
        `Licença emitida (${tierLabel(r.version_tier as VersionTier)})${r.invited ? " · convite enviado" : ""}`,
      );
      onIssued?.();
      void loadQuota();
    } catch (err: any) {

      toast.error(err?.message || "Falha ao emitir licença");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "terminal-card scanlines relative p-5"}>
      {!compact && (
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neon" />
            <h3 className="font-mono text-sm uppercase text-neon">// emitir licença para cliente</h3>
          </div>
          {quota && !quota.unlimited && (
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase">
              <span className={quota.daily.remaining === 0 ? "text-danger" : "text-muted-foreground"}>
                hoje: <span className="text-foreground">{quota.daily.used}</span>/{quota.daily.limit}
              </span>
              <span className={quota.monthly.remaining === 0 ? "text-danger" : "text-muted-foreground"}>
                mês: <span className="text-foreground">{quota.monthly.used}</span>/{quota.monthly.limit}
              </span>
            </div>
          )}
        </div>
      )}

      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
            Email do cliente
          </span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            required
          />
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
            Plano
          </span>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as any)}
            className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
          >
            <option value="login-7d">Semanal (7d · v4.5.5)</option>
            <option value="login-30d">Mensal (30d · v4.5.7 + Bypass)</option>
            <option value="login-lifetime">Vitalício (v4.6 + updates + prioridade)</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
            Painel
          </span>
          <select
            value={panel}
            onChange={(e) => setPanel(e.target.value as any)}
            className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
          >
            <option value="auto">Auto (pelo plano)</option>
            <option value="v457">Shadow 4.5.7 (VPS 191.96.78.81)</option>
            <option value="v46">Shadow 4.6 (VPS 200.9.154.103)</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
            Expira (opcional)
          </span>
          <Input
            type="date"
            value={customExpire}
            onChange={(e) => setCustomExpire(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 rounded border border-border/40 bg-background/40 px-3 py-2">
          <input
            type="checkbox"
            checked={isLegacy}
            onChange={(e) => setIsLegacy(e.target.checked)}
          />
          <span className="font-mono text-xs uppercase">Cliente antigo</span>
        </label>
        <label className={isLegacy ? "" : "opacity-50 pointer-events-none"}>
          <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
            Taxa mensal servidor (R$)
          </span>
          <Input
            type="number"
            min={0}
            step="1"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </label>
        {initialThreadId && (
          <label className="md:col-span-2 flex items-center gap-2 rounded border border-violet/30 bg-violet/5 px-3 py-2">
            <input
              type="checkbox"
              checked={postToThread}
              onChange={(e) => setPostToThread(e.target.checked)}
            />
            <span className="font-mono text-xs">Postar credenciais neste chat automaticamente</span>
          </label>
        )}
        <div className="md:col-span-2">
          <Button
            type="submit"
            disabled={busy}
            className="glow-neon font-mono uppercase tracking-wider"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Emitir licença
          </Button>
        </div>
      </form>
      {result && (
        <div className="mt-4 rounded border border-neon/30 bg-neon/5 p-3 font-mono text-xs">
          <div className="mb-1 uppercase text-neon">// licença criada</div>
          <div>
            user: <span className="text-foreground">{result.credentials.username}</span>
          </div>
          <div>
            email: <span className="text-foreground">{result.credentials.email}</span>
          </div>
          <div>
            senha: <span className="text-foreground">{result.credentials.password}</span>
          </div>
          <div>
            servidor: <span className="text-foreground">{result.credentials.server_ip}</span>
          </div>
          <div>
            expira:{" "}
            <span className="text-foreground">
              {new Date(result.expires_at).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueInThreadButton({
  threadId,
  defaultEmail,
}: {
  threadId: string;
  defaultEmail: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        className="font-mono text-[10px] uppercase"
        onClick={() => setOpen((v) => !v)}
      >
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
  const [lookupResult, setLookupResult] = useState<{ panels: string[]; found: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const legacyList = [...licenses]
    .filter((l) => l.is_legacy)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  // ---- filtros / paginação da lista abaixo ----
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "overdue" | "revoked" | "disabled"
  >("all");
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
      const s = l.disabled_at
        ? "disabled"
        : l.revoked
          ? "revoked"
          : l.server_overdue_at
            ? "overdue"
            : "active";
      if (s !== statusFilter) return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredLegacy.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredLegacy.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, tierFilter]);

  const counts = {
    total: legacyList.length,
    active: legacyList.filter((l) => !l.disabled_at && !l.revoked && !l.server_overdue_at).length,
    overdue: legacyList.filter((l) => !l.disabled_at && !l.revoked && l.server_overdue_at).length,
    revoked: legacyList.filter((l) => l.revoked && !l.disabled_at).length,
    disabled: legacyList.filter((l) => l.disabled_at).length,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !email.trim() ||
      !yaarsaUsername.trim() ||
      !yaarsaEmail.trim() ||
      !yaarsaPassword.trim() ||
      !expiresAt
    ) {
      return toast.error("Preencha todos os campos obrigatórios");
    }
    setBusy(true);
    setLastResult(null);
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
      toast.success(
        `Cliente antigo registrado (${tierLabel(r.version_tier as VersionTier)})${r.invited ? " · convite enviado" : ""}`,
      );
      // Limpar apenas campos sensíveis; mantém plano/taxa para lote
      setYaarsaUsername("");
      setYaarsaEmail("");
      setYaarsaPassword("");
      setServerIp("");
      setEmail("");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao registrar cliente antigo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="terminal-card scanlines relative p-5">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-cyan" />
          <h3 className="font-mono text-sm uppercase text-cyan">
            // registrar cliente antigo (login existente)
          </h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Use esta tela para <b className="text-foreground">clientes que já têm login existente</b>.
          Nenhuma nova conta é criada; apenas vinculamos o login existente ao usuário e marcamos
          como <span className="font-mono text-cyan">legacy</span>
          (taxa mensal de servidor R$ 250 em vez de R$ 450). Para gerar um login novo do zero, use
          "Emitir Licença".
        </p>

        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
              Email do cliente no Shadow *
            </span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              required
            />
          </label>

          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
              Plano / Tier *
            </span>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as any)}
              className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
            >
              <option value="login-7d">Semanal · v4.5.5</option>
              <option value="login-30d">Mensal · v4.5.7 + Bypass</option>
              <option value="login-lifetime">Vitalício · v4.6 + updates + prioridade</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
              Expira em *
            </span>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          </label>

          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
              Login · username *
            </span>
            <Input
              value={yaarsaUsername}
              onChange={(e) => setYaarsaUsername(e.target.value)}
              placeholder="ex: abcde"
              required
            />
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
              Login · email *
            </span>
            <Input
              type="email"
              value={yaarsaEmail}
              onChange={(e) => setYaarsaEmail(e.target.value)}
              placeholder="login@shadow.local"
              required
            />
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
              Login · senha *
            </span>
            <Input
              value={yaarsaPassword}
              onChange={(e) => setYaarsaPassword(e.target.value)}
              placeholder="senha existente"
              required
            />
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
              IP do servidor (opcional)
            </span>
            <Input
              value={serverIp}
              onChange={(e) => setServerIp(e.target.value)}
              placeholder="191.96.78.81"
            />
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
              Painel
            </span>
            <select
              value={panel}
              onChange={(e) => setPanel(e.target.value as any)}
              className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
            >
              <option value="auto">Auto (pelo plano)</option>
              <option value="v457">Shadow 4.5.7 (VPS 191.96.78.81)</option>
              <option value="v46">Shadow 4.6 (VPS 200.9.154.103)</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block font-mono text-[10px] uppercase text-muted-foreground">
              Taxa mensal servidor (R$)
            </span>
            <Input
              type="number"
              min={0}
              step="1"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-2 rounded border border-cyan/20 bg-cyan/5 p-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={lookupBusy || !yaarsaEmail.trim()}
              onClick={async () => {
                setLookupBusy(true);
                setLookupResult(null);
                try {
                  const { adminLookupYaarsaEmail } = await import("@/lib/admin.functions");
                  const r = await adminLookupYaarsaEmail({
                    data: { email: yaarsaEmail.trim().toLowerCase() },
                  });
                  setLookupResult({
                    found: r.found,
                    panels: (r.details ?? []).filter((d: any) => d.found).map((d: any) => d.panel),
                  });
                  if (r.found)
                    toast.success(
                      `Login encontrado em: ${r.panel === "v46" ? "Shadow 4.6" : "Shadow 4.5.7"}`,
                    );
                  else toast.error("Email não encontrado em nenhum painel");
                } catch (e: any) {
                  toast.error(e?.message || "Falha ao consultar servidor");
                } finally {
                  setLookupBusy(false);
                }
              }}
              className="font-mono text-[10px] uppercase"
            >
              {lookupBusy ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <History className="mr-1 h-3 w-3" />
              )}
              Verificar email nos painéis
            </Button>
            {lookupResult && (
              <span className="font-mono text-[11px]">
                {lookupResult.found ? (
                  <span className="text-neon">
                    ✓ encontrado em: {lookupResult.panels.join(", ")}
                  </span>
                ) : (
                  <span className="text-red-400">✗ não encontrado em nenhum painel</span>
                )}
              </span>
            )}
          </div>

          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={busy}
              className="glow-cyan font-mono uppercase tracking-wider"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Registrar cliente antigo
            </Button>
          </div>
        </form>

        {lastResult && (
          <div className="mt-4 rounded border border-cyan/30 bg-cyan/5 p-3 font-mono text-xs">
            <div className="mb-1 uppercase text-cyan">// registrado</div>
            <div>
              licença: <span className="text-foreground">{lastResult.licenseId}</span>
            </div>
            <div>
              tier:{" "}
              <span className="text-foreground">
                {tierLabel(lastResult.version_tier as VersionTier)}
              </span>
            </div>
            {lastResult.invited && (
              <div className="text-neon">convite enviado ao email do cliente</div>
            )}
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
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
                setTierFilter("all");
              }}
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
            {legacyList.length === 0
              ? "Nenhum cliente antigo registrado ainda."
              : "Nenhum resultado para os filtros aplicados."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((l) => {
                const tier = (l.version_tier as VersionTier | null) ?? "monthly_457";
                const fee =
                  Number(l.legacy_server_fee_brl) > 0 ? Number(l.legacy_server_fee_brl) : 250;
                const status = l.disabled_at
                  ? "desativada"
                  : l.revoked
                    ? "revogada"
                    : l.server_overdue_at
                      ? "servidor atrasado"
                      : "ativa";
                const statusColor =
                  l.disabled_at || l.revoked
                    ? "border-danger/60 text-danger"
                    : l.server_overdue_at
                      ? "border-amber-400/60 text-amber-400"
                      : "border-neon/60 text-neon";
                const tierColor =
                  tier === "lifetime_46"
                    ? "text-violet"
                    : tier === "monthly_457"
                      ? "text-neon"
                      : "text-cyan";
                const daysToExpire = l.expires_at
                  ? Math.ceil((+new Date(l.expires_at) - Date.now()) / 86400000)
                  : null;
                return (
                  <div
                    key={l.id}
                    className="group relative border border-border/40 bg-background/40 p-4 transition hover:border-cyan/60 hover:bg-cyan/5 sm:p-3"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2 sm:mb-2">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm text-foreground">
                          {l.yaarsa_username || "—"}
                        </div>
                        <div className="truncate font-mono text-xs text-muted-foreground sm:text-[10px]">
                          {l.yaarsa_email || "—"}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase sm:text-[9px] ${statusColor}`}
                      >
                        {status}
                      </span>
                    </div>
                    <div className="mb-3 flex items-center justify-between gap-2 border-y border-border/30 py-2 sm:mb-2">
                      <span
                        className={`font-mono text-[11px] uppercase sm:text-[10px] ${tierColor}`}
                      >
                        {tierLabel(tier)}
                      </span>
                      <span className="font-mono text-sm sm:text-xs">
                        {formatBrl(fee)}
                        <span className="text-[11px] text-muted-foreground sm:text-[10px]">
                          /mês
                        </span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 font-mono text-xs sm:gap-2 sm:text-[10px]">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[9px]">
                          Licença expira
                        </div>
                        <div
                          className={
                            daysToExpire !== null && daysToExpire <= 7 ? "text-amber-400" : ""
                          }
                        >
                          {l.expires_at ? new Date(l.expires_at).toLocaleDateString("pt-BR") : "—"}
                          {daysToExpire !== null && daysToExpire >= 0 && daysToExpire <= 30 && (
                            <span className="ml-1 text-muted-foreground">({daysToExpire}d)</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[9px]">
                          Servidor pago até
                        </div>
                        <div>
                          {l.server_paid_until
                            ? new Date(l.server_paid_until).toLocaleDateString("pt-BR")
                            : "—"}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[9px]">
                          Ativado em
                        </div>
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
      </motion.div>
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
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const perLicense = rows.filter((r) => r.action === "revoke_license");
  const cronRuns = rows.filter((r) => r.action === "cron");
  const shown = onlyFailed ? perLicense.filter((r) => r.outcome !== "revoked") : perLicense;

  function exportCsv() {
    const cols = [
      "created_at",
      "outcome",
      "user_email",
      "yaarsa_email",
      "license_id",
      "reason",
      "suspended_until",
      "error",
    ];
    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [cols.join(",")];
    for (const r of shown) {
      const ctx = r.context || {};
      lines.push(
        cols
          .map((c) => {
            if (c === "user_email") return esc(userById.get(ctx.user_id) || "");
            if (c === "created_at" || c === "outcome" || c === "error") return esc(r[c]);
            return esc(ctx[c]);
          })
          .join(","),
      );
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auto-revocations-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="terminal-card scanlines relative p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldAlert className="h-4 w-4 text-neon" />
          <div className="flex-1">
            <div className="font-mono text-xs uppercase text-neon">
              Auditoria de Revogações Automáticas
            </div>
            <div className="text-[11px] text-muted-foreground">
              Registros gerados pelo cron diário (dia 20 / servidor vencido). Uma linha por licença
              afetada.
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-mono uppercase text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyFailed}
              onChange={(e) => setOnlyFailed(e.target.checked)}
            />
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
          <Stat
            label="Suspensas"
            value={perLicense.filter((r) => r.outcome === "revoked").length}
            color="text-cyan"
          />
          <Stat
            label="Falhas"
            value={perLicense.filter((r) => r.outcome !== "revoked").length}
            color="text-red-400"
          />
          <Stat label="Execuções do cron" value={cronRuns.length} color="text-violet-300" />
        </div>
      </div>

      <div className="terminal-card scanlines relative overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
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
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center font-mono text-xs text-muted-foreground"
                  >
                    {loading ? "carregando…" : "Nenhuma revogação automática registrada."}
                  </td>
                </tr>
              )}
              {shown.map((r) => {
                const ctx = r.context || {};
                const lic = licById.get(ctx.license_id);
                const ok = r.outcome === "revoked";
                return (
                  <tr key={r.id} className="border-b border-border/20 align-top">
                    <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-xs">
                      <div>
                        {userById.get(ctx.user_id) || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {ctx.user_id?.slice(0, 8)}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">{ctx.yaarsa_email || "—"}</td>
                    <td className="p-3 font-mono text-[11px]">
                      <div>{lic?.plan_slug || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {ctx.license_id?.slice(0, 8)}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-amber-300">
                      {ctx.reason === "server_overdue_day20"
                        ? "Servidor vencido (dia 20)"
                        : ctx.reason || "—"}
                      <div className="text-[10px] text-muted-foreground">
                        até {ctx.suspended_until || "—"}
                      </div>
                    </td>
                    <td
                      className={`p-3 font-mono text-[11px] uppercase ${ok ? "text-cyan" : "text-red-400"}`}
                    >
                      {ok ? "suspenso" : "falhou"}
                      {r.error && (
                        <div className="text-[10px] normal-case text-muted-foreground">
                          {r.error}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
  const updateStatusFn = useServerFn(adminUpdateReferralStatus);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");

  async function load() {
    setLoading(true);
    try {
      setRows((await listFn()) as any[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, []);

  async function updateStatus(id: string, status: "pending" | "granted" | "paid" | "rejected") {
    try {
      await updateStatusFn({ data: { referralId: id, status } });
      toast.success("Atualizado");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }


  const filtered = rows.filter((r) =>
    filter === "all"
      ? true
      : filter === "pending"
        ? r.reward_status === "pending"
        : r.reward_status === "paid",
  );
  const totalPending = rows.filter((r) => r.reward_status === "pending").length;
  const totalPixDue = rows
    .filter((r) => r.reward_type === "pix" && r.reward_status === "pending")
    .reduce((s, r) => s + Number(r.reward_amount), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="terminal-card p-4">
          <div className="font-mono text-[10px] uppercase text-muted-foreground">
            Total de indicações
          </div>
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
        {(["all", "pending", "paid", "rejected"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f as any)}
            className="font-mono text-[10px] uppercase"
          >
            {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : f === "paid" ? "Pagos" : "Recusados"}
          </Button>
        ))}

        <Button
          size="sm"
          variant="ghost"
          onClick={load}
          className="ml-auto font-mono text-[10px] uppercase"
        >
          <RefreshCw className="mr-1 h-3 w-3" /> Atualizar
        </Button>
      </div>

      <div className="terminal-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center font-mono text-xs text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center font-mono text-xs text-muted-foreground">
            Nenhuma indicação.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
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
                    <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3 text-xs">{r.referrer_email ?? "—"}</td>
                    <td className="p-3 text-xs">{r.referred_email ?? "—"}</td>
                    <td className="p-3 font-mono text-[11px] uppercase">
                      {r.reward_type === "cashback"
                        ? "Cashback"
                        : r.reward_type === "free_month"
                          ? "Mensalidade"
                          : "PIX"}
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {formatBrl(Number(r.reward_amount))}
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {r.reward_type === "pix"
                        ? (r.pix_key ?? <span className="text-amber-300">sem chave</span>)
                        : "—"}
                    </td>
                    <td
                      className={`p-3 font-mono text-[11px] uppercase ${
                        r.reward_status === "paid"
                          ? "text-neon"
                          : r.reward_status === "granted"
                            ? "text-cyan"
                            : "text-amber-300"
                      }`}
                    >
                      {r.reward_status}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {r.reward_status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => updateStatus(r.id, "paid")}
                              className="bg-emerald-600 hover:bg-emerald-500 font-mono text-[10px] uppercase"
                            >
                              <Check className="mr-1 h-3 w-3" /> Pagar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus(r.id, "rejected")}
                              className="text-red-400 hover:text-red-300 font-mono text-[10px] uppercase"
                            >
                              <Ban className="mr-1 h-3 w-3" /> Recusar
                            </Button>
                          </>
                        )}
                        {r.reward_status !== "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(r.id, "pending")}
                            className="font-mono text-[10px] uppercase"
                          >
                            Reabrir
                          </Button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SupportQuotasPanel() {
  const listFn = useServerFn(listSupportQuotas);
  const updateFn = useServerFn(updateSupportQuota);



  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFn();
      setStaff(data as any[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(userId: string, daily: number, monthly: number) {
    setBusy(userId);
    try {
      await updateFn({ data: { targetUserId: userId, dailyLimit: daily, monthlyLimit: monthly } });
      toast.success("Cota atualizada");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      <div className="terminal-card scanlines relative p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-violet" />
            <h3 className="font-mono text-sm uppercase text-violet">// controle de cotas suporte</h3>
          </div>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
          Defina limites para o número de licenças manuais que membros da equipe de Suporte (Moderadores)
          podem gerar por dia e por mês. Administradores têm cota ilimitada.
        </p>

        {loading ? (
          <div className="py-8 text-center font-mono text-xs text-muted-foreground animate-pulse">
            acessando logs de atividade...
          </div>
        ) : staff.length === 0 ? (
          <div className="rounded border border-dashed border-border/40 py-8 text-center text-xs text-muted-foreground">
            nenhum moderador encontrado na equipe
          </div>
        ) : (
          <div className="grid gap-3">
            {staff.map((s) => (
              <div key={s.userId} className="rounded border border-border/40 bg-background/40 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-foreground truncate">{s.email || "staff-id: " + s.userId.slice(0,8)}</div>
                    <div className="text-[10px] text-muted-foreground">ID: {s.userId}</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded bg-background/60 px-2 py-1 text-center min-w-[60px]">
                      <div className="text-[9px] uppercase text-muted-foreground">Hoje</div>
                      <div className={`font-mono text-xs ${s.daily.remaining === 0 ? "text-danger" : "text-neon"}`}>
                        {s.daily.used}/{s.daily.limit}
                      </div>
                    </div>
                    <div className="rounded bg-background/60 px-2 py-1 text-center min-w-[60px]">
                      <div className="text-[9px] uppercase text-muted-foreground">Mês</div>
                      <div className={`font-mono text-xs ${s.monthly.remaining === 0 ? "text-danger" : "text-neon"}`}>
                        {s.monthly.used}/{s.monthly.limit}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-end gap-3 border-t border-border/20 pt-3">
                  <label className="flex-1 min-w-[100px]">
                    <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Limite Diário</span>
                    <Input 
                      type="number" 
                      defaultValue={s.daily.limit} 
                      className="h-8 text-xs font-mono"
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val !== s.daily.limit) update(s.userId, val, s.monthly.limit);
                      }}
                    />
                  </label>
                  <label className="flex-1 min-w-[100px]">
                    <span className="mb-1 block font-mono text-[9px] uppercase text-muted-foreground">Limite Mensal</span>
                    <Input 
                      type="number" 
                      defaultValue={s.monthly.limit} 
                      className="h-8 text-xs font-mono"
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val !== s.monthly.limit) update(s.userId, s.daily.limit, val);
                      }}
                    />
                  </label>
                  {busy === s.userId && (
                    <div className="h-8 flex items-center px-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-violet" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

