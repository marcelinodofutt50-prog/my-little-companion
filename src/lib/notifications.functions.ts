import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationKind = 'support' | 'renewal' | 'refund' | 'suspended' | 'order' | 'migration' | 'license' | 'info';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  createdAt: string;
  href?: string;
  actionLabel?: string;
}


export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ago } = await import("@/lib/notifications.server");
    const { resolveRoles } = await import("@/lib/roles.server");
    const { isStaff } = await resolveRoles(context);
    const items: AppNotification[] = [];

    if (isStaff) {
      // Admin: tickets com mensagens não lidas pela equipe
      const { data: threads } = await context.supabase
        .from("support_threads")
        .select("id, subject, status, unread_by_staff, last_customer_message_at, updated_at, priority")
        .gt("unread_by_staff", 0)
        .neq("status", "closed")
        .order("last_customer_message_at", { ascending: false })
        .limit(20);

      for (const t of threads ?? []) {
        items.push({
          id: `thread-staff-${t.id}-${t.unread_by_staff}`,
          kind: "support",
          title: `Nova mensagem no ticket`,
          description: `${t.subject ?? "Suporte"} · ${t.unread_by_staff} não lida(s)${t.priority === "high" ? " · prioridade alta" : ""}`,
          createdAt: ago(t.last_customer_message_at ?? t.updated_at),
          href: `/admin?tab=suporte&thread=${t.id}`,
          actionLabel: "Responder",
        });
      }

      // Logins que sumiram do painel Yaarsa nas últimas 24h.
      const since = new Date(Date.now() - 86400000).toISOString();
      const { data: drift } = await context.supabase
        .from("integration_logs")
        .select("id, created_at, outcome, error, context")
        .eq("source", "panel-integrity")
        .eq("action", "audit_license")
        .in("outcome", ["missing", "no_password", "repaired"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);

      for (const d of drift ?? []) {
        const ctx = (d.context ?? {}) as { email?: string; panel?: string };
        const repaired = d.outcome === "repaired";
        items.push({
          id: `panel-drift-${d.id}`,
          kind: "license",
          title: repaired ? "Login recriado no painel" : "Login sumiu do painel Yaarsa",
          description: `${ctx.email ?? "conta"} (${ctx.panel ?? "painel"}) — ${repaired ? "recriado automaticamente com a mesma senha." : (d.error ?? "precisa de correção manual.")}`,
          createdAt: ago(d.created_at),
          href: "/admin?tab=panel_integrity",
          actionLabel: "Abrir conferência",
        });
      }
    } else {
      // Cliente: respostas do suporte + mudanças de status nos próprios tickets
      const { data: threads } = await context.supabase
        .from("support_threads")
        .select("id, subject, status, unread_by_customer, last_staff_message_at, updated_at, closed_at")
        .eq("user_id", context.userId)
        .order("updated_at", { ascending: false })
        .limit(10);

      for (const t of threads ?? []) {
        if ((t.unread_by_customer ?? 0) > 0) {
          items.push({
            id: `thread-cust-${t.id}-${t.unread_by_customer}`,
            kind: "support",
            title: "O suporte respondeu você",
            description: `${t.subject ?? "Suporte"} · ${t.unread_by_customer} nova(s) mensagem(ns)`,
            createdAt: ago(t.last_staff_message_at ?? t.updated_at),
            href: "/suporte",
            actionLabel: "Abrir chat",
          });
        }
        if (t.status === "closed" && t.closed_at) {
          items.push({
            id: `thread-closed-${t.id}-${t.closed_at}`,
            kind: "info",
            title: "Ticket encerrado",
            description: `${t.subject ?? "Suporte"} foi finalizado pela equipe.`,
            createdAt: ago(t.closed_at),
            href: "/suporte",
          });
        }
      }

      // Avisos de vencimento da licença (3 dias, 1 dia e vencida).
      const { data: licenses } = await context.supabase
        .from("licenses")
        .select("id, plan_slug, expires_at, revoked, disabled_at, suspended_at, is_trial, updated_at")
        .eq("user_id", context.userId)
        .is("disabled_at", null)
        .eq("revoked", false)
        .limit(10);

      const DAY = 86400000;
      for (const l of licenses ?? []) {
        if (l.suspended_at) continue;
        if (!l.expires_at) continue;
        const slug = (l.plan_slug ?? "").toLowerCase();
        if (slug.includes("lifetime") || slug.includes("vitalicio")) continue;
        const msLeft = new Date(l.expires_at).getTime() - Date.now();
        if (msLeft > 3 * DAY) continue;
        const daysLeft = Math.ceil(msLeft / DAY);
        const expired = msLeft <= 0;
        const bucket = expired ? "expired" : daysLeft <= 1 ? "1d" : "3d";
        items.push({
          id: `license-expiry-${l.id}-${bucket}`,
          kind: expired ? "suspended" : "renewal",
          title: expired
            ? "Sua licença venceu"
            : daysLeft <= 1
              ? "Sua licença vence em menos de 24 horas"
              : `Sua licença vence em ${daysLeft} dias`,
          description: expired
            ? "O login foi encerrado. Renove para voltar a usar agora mesmo."
            : `${l.is_trial ? "Teste grátis" : "Plano"} termina em ${new Date(l.expires_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}. Renove antes para não perder o acesso.`,
          createdAt: ago(l.updated_at ?? new Date().toISOString()),
          href: "/planos",
          actionLabel: "Renovar",
        });
      }
    }

    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { isAdmin: isStaff, items: items.slice(0, 30) };
  });


export const getNotificationSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    return {
      email_enabled: true,
      webhook_enabled: false,
      webhook_url: "",
      notify_on_approval: true,
      notify_on_pending: true,
      notify_on_denial: true,
      notify_on_server_release: true
    };
  });


export const updateNotificationSettings = createServerFn({ method: "POST" })
  .validator((d: any) => z.object({
    email_enabled: z.boolean(),
    webhook_enabled: z.boolean(),
    webhook_url: z.string().url().optional().or(z.literal("")),
    notify_on_approval: z.boolean(),
    notify_on_pending: z.boolean(),
    notify_on_denial: z.boolean(),
    notify_on_server_release: z.boolean()
  }).parse(d))
  .handler(async ({ data }) => {
    return { success: true };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .validator((d: any) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    return { success: true };
  });
