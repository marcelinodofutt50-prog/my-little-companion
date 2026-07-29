import { useState } from "react";
import { Bell, RefreshCcw, ShieldAlert, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationKind = "renewal" | "refund" | "suspended" | "info";

type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  createdAt: string;
  read?: boolean;
};

const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "1",
    kind: "renewal",
    title: "Sua licença expira em breve",
    description: "Renove agora e mantenha o acesso sem interrupções.",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "2",
    kind: "refund",
    title: "Reembolso aprovado",
    description: "Seu pedido de reembolso foi processado com sucesso.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    read: true,
  },
  {
    id: "3",
    kind: "suspended",
    title: "Licença suspensa",
    description: "Uma de suas licenças foi suspensa por inatividade.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
  },
];

const ICONS: Record<NotificationKind, any> = {
  renewal: RefreshCcw,
  refund: CheckCircle2,
  suspended: ShieldAlert,
  info: Bell,
};

const COLORS: Record<NotificationKind, string> = {
  renewal: "text-amber-400",
  refund: "text-neon",
  suspended: "text-danger",
  info: "text-cyan",
};

export function InAppNotifications() {
  const [notifications] = useState<AppNotification[]>(DEMO_NOTIFICATIONS);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-primary">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[9px] font-bold text-background">
              {unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-border/50 bg-card/95 backdrop-blur-md">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">
          // notificações
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 && (
          <div className="p-4 text-center font-mono text-xs text-muted-foreground">Nenhuma notificação</div>
        )}
        <div className="max-h-80 overflow-y-auto">
          {notifications.map((n) => {
            const Icon = ICONS[n.kind];
            return (
              <div
                key={n.id}
                className={`flex gap-2.5 border-b border-border/30 px-3 py-2.5 last:border-0 ${
                  n.read ? "opacity-70" : "bg-neon/[0.03]"
                }`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${COLORS[n.kind]}`} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground">{n.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{n.description}</div>
                  <div className="mt-1 font-mono text-[9px] text-muted-foreground/70">
                    {new Date(n.createdAt).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
