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

function ago(iso: string) {
  return new Date(iso).toISOString();
}

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
  .inputValidator((d: any) => z.object({
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
  .inputValidator((d: any) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    return { success: true };
  });
