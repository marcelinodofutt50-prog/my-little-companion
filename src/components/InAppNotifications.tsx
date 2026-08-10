import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, BellOff, RefreshCcw, ShieldAlert, CheckCircle2, MessageSquare, Receipt, ArrowLeftRight, Archive, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyRole, isStaffRole } from "@/lib/roles";
import { listMyNotifications, type AppNotification, type NotificationKind } from "@/lib/notifications.functions";
import { playNotifyDing, requestNotifyPermission, showDesktopNotification, unlockNotifySound } from "@/lib/notify-sound";

const ICONS: Record<NotificationKind, typeof Bell> = {
  support: MessageSquare,
  renewal: RefreshCcw,
  refund: CheckCircle2,
  suspended: ShieldAlert,
  order: Receipt,
  migration: ArrowLeftRight,
  license: Archive,
  info: Bell,
};

const COLORS: Record<NotificationKind, string> = {
  support: "text-violet",
  renewal: "text-amber-400",
  refund: "text-neon",
  suspended: "text-destructive",
  order: "text-cyan",
  migration: "text-cyan",
  license: "text-amber-400",
  info: "text-muted-foreground",
};

const READ_KEY = "shadow.notifications.read";

function loadRead(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(READ_KEY) ?? "[]"); } catch { return []; }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function InAppNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => loadRead());
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const knownRef = useRef<Set<string> | null>(null);


  const fetchFn = useServerFn(listMyNotifications);

  const refresh = useCallback(async (announce = true) => {
    try {
      const res = (await fetchFn()) as { isAdmin: boolean; items: AppNotification[] };
      const data = res.items ?? [];
      setIsAdmin(!!res.isAdmin);
      setAdminChecked(true);
      setItems(data);
      const known = knownRef.current;
      if (known && announce) {
        const fresh = data.filter((n) => !known.has(n.id));
        const important = fresh.find((n) => n.kind === "support" || n.kind === "order" || n.kind === "suspended");
        if (important) {
          playNotifyDing();
          toast.message(important.title, { description: important.description });
          if (res.isAdmin) showDesktopNotification(important.title, important.description);
        } else if (fresh.length > 0) {
          toast.message(fresh[0].title, { description: fresh[0].description });
        }
      }
      knownRef.current = new Set(data.map((n) => n.id));
    } catch {
      /* silencioso: notificações nunca devem quebrar a página */
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    requestNotifyPermission();
    void refresh(false);
    const t = setInterval(() => void refresh(), 60_000);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const role = await fetchMyRole(uid);
      const admin = isStaffRole(role);
      setIsAdmin(admin);
      setAdminChecked(true);
      channel = supabase
        .channel(`notif-${uid}-${Math.random().toString(36).slice(2, 8)}`)

        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${uid}` }, () => void refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "refund_requests", filter: `user_id=eq.${uid}` }, () => void refresh());
      if (admin) {
        // Equipe: qualquer novo ticket, mensagem ou mudança de status
        channel = channel
          .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" }, () => void refresh())
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, () => void refresh());
      } else {
        // Cliente: respostas e mudanças de status nos próprios tickets
        channel = channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "support_threads", filter: `user_id=eq.${uid}` },
          () => void refresh(),
        );
      }
      channel.subscribe();
    });

    return () => {
      clearInterval(t);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  const unread = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000
    return items.filter((n) => !readIds.includes(n.id) && new Date(n.createdAt).getTime() >= cutoff)
  }, [items, readIds]);


  function markAllRead() {
    const ids = Array.from(new Set([...readIds, ...items.map((n) => n.id)])).slice(-200);
    setReadIds(ids);
    try { localStorage.setItem(READ_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
  }

  if (!adminChecked) return null;


  return (
    <DropdownMenu onOpenChange={(open) => { if (open) { unlockNotifySound(); void refresh(false); markAllRead(); } }}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notificações"
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-primary"
        >
          <Bell className={`h-4 w-4 ${unread.length > 0 ? "animate-pulse text-primary" : ""}`} />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[9px] font-bold text-background">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-border/50 bg-card/95 backdrop-blur-md">
        <DropdownMenuLabel className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">
          <span>// notificações{isAdmin ? " · admin" : ""}</span>
          {items.length > 0 && (
            <button onClick={markAllRead} className="text-[9px] normal-case tracking-normal text-muted-foreground hover:text-primary">
              marcar tudo como lido
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && (
          <div className="flex items-center justify-center gap-2 p-4 font-mono text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-4 text-center font-mono text-xs text-muted-foreground">Tudo em dia. Sem novidades.</div>
        )}
        <div className="max-h-80 overflow-y-auto">
          {items.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell;
            const isRead = readIds.includes(n.id);
            const content = (
              <div
                className={`flex gap-2.5 border-b border-border/30 px-3 py-2.5 last:border-0 transition-colors hover:bg-primary/5 ${
                  isRead ? "opacity-60" : "bg-primary/[0.04]"
                }`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${COLORS[n.kind] ?? "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground">{n.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{n.description}</div>
                  {n.actionLabel && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-primary">
                      <RefreshCcw className="h-3 w-3" /> {n.actionLabel}
                    </span>
                  )}
                  <div className="mt-1 font-mono text-[9px] text-muted-foreground/70">{timeAgo(n.createdAt)}</div>

                </div>
              </div>
            );
            const [hrefPath, hrefQuery] = (n.href ?? "").split("?");
            const search = hrefQuery
              ? Object.fromEntries(new URLSearchParams(hrefQuery).entries())
              : undefined;
            return n.href ? (
              <Link
                key={n.id}
                to={hrefPath as string}
                search={search as never}
                onClick={markAllRead}
                className="block"
              >
                {content}
              </Link>
            ) : (

              <div key={n.id}>{content}</div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
