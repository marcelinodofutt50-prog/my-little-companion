import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationKind = "support" | "renewal" | "refund" | "suspended" | "order" | "migration" | "info";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  createdAt: string;
  /** Rota interna para onde o clique deve levar. */
  href?: string;
};

/**
 * Agrega notificações reais do usuário (suporte, licenças, reembolsos,
 * pedidos e migração) num feed único ordenado por data.
 */
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const out: AppNotification[] = [];
    const now = Date.now();

    // Notificações de chat/mensagens são exclusivas de admins.
    const { data: isAdminRaw } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const isAdmin = !!isAdminRaw;

    const [threads, licenses, refunds, orders, migrations] = await Promise.all([
      isAdmin
        ? supabase
            .from("support_threads")
            .select("id, subject, status, unread_by_staff, last_customer_message_at, updated_at")
            .gt("unread_by_staff", 0)
            .order("updated_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("licenses")
        .select("id, plan_slug, expires_at, revoked, suspended_at, disabled_at, server_overdue_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("refund_requests")
        .select("id, status, amount, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("orders")
        .select("id, plan_slug, status, amount, created_at, paid_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("migration_requests")
        .select("id, status, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

    if (isAdmin) {
      for (const t of threads.data ?? []) {
        const unread = (t as { unread_by_staff?: number }).unread_by_staff ?? 0;
        if (unread <= 0) continue;
        out.push({
          id: `support-${t.id}-${(t as { last_customer_message_at?: string }).last_customer_message_at ?? t.updated_at}`,
          kind: "support",
          title: unread === 1 ? "Nova mensagem de cliente" : `${unread} novas mensagens de clientes`,
          description: t.subject ? `Ticket: ${t.subject}` : "Um cliente aguarda resposta no chat.",
          createdAt: (t as { last_customer_message_at?: string }).last_customer_message_at ?? t.updated_at,
          href: "/admin",
        });
      }
    }

    for (const l of licenses.data ?? []) {
      if (l.disabled_at) continue;
      if (l.revoked) {
        out.push({
          id: `lic-revoked-${l.id}`,
          kind: "suspended",
          title: "Licença bloqueada",
          description: l.server_overdue_at
            ? "Mensalidade do servidor em atraso. Regularize para reativar."
            : "Uma licença sua foi bloqueada. Fale com o suporte.",
          createdAt: l.updated_at,
          href: l.server_overdue_at ? "/renovar-servidor" : "/suporte",
        });
        continue;
      }
      if (l.suspended_at) {
        out.push({
          id: `lic-susp-${l.id}`,
          kind: "suspended",
          title: "Licença pausada",
          description: "Você pausou esta licença. Reative quando quiser no dashboard.",
          createdAt: l.suspended_at,
          href: "/dashboard",
        });
        continue;
      }
      if (l.expires_at) {
        const days = Math.ceil((new Date(l.expires_at).getTime() - now) / 86400000);
        if (days <= 7) {
          out.push({
            id: `lic-exp-${l.id}-${days}`,
            kind: "renewal",
            title: days <= 0 ? "Licença expirada" : `Sua licença expira em ${days} dia${days === 1 ? "" : "s"}`,
            description: days <= 0 ? "Renove para voltar a usar o painel." : "Renove agora e evite qualquer interrupção.",
            createdAt: new Date(Math.min(now, new Date(l.expires_at).getTime())).toISOString(),
            href: "/planos",
          });
        }
      }
    }

    for (const r of refunds.data ?? []) {
      const map: Record<string, { title: string; description: string }> = {
        approved: { title: "Reembolso aprovado", description: "Seu reembolso foi aprovado e será pago em breve." },
        paid: { title: "Reembolso pago", description: "O valor do reembolso já foi enviado para sua chave PIX." },
        rejected: { title: "Reembolso recusado", description: "Seu pedido de reembolso não foi aprovado. Fale com o suporte." },
        pending: { title: "Reembolso em análise", description: "Recebemos seu pedido. Retorno em até 2 dias." },
      };
      const info = map[r.status];
      if (info) {
        out.push({
          id: `refund-${r.id}-${r.status}`,
          kind: "refund",
          title: info.title,
          description: info.description,
          createdAt: r.updated_at,
          href: "/dashboard",
        });
      }
    }

    for (const o of orders.data ?? []) {
      if (o.status === "paid" && o.paid_at) {
        out.push({
          id: `order-paid-${o.id}`,
          kind: "order",
          title: "Pagamento confirmado",
          description: "Seu acesso foi liberado. Confira suas credenciais no dashboard.",
          createdAt: o.paid_at,
          href: "/dashboard",
        });
      } else if (o.status === "pending") {
        const ageMin = (now - new Date(o.created_at).getTime()) / 60000;
        if (ageMin < 60 * 24) {
          out.push({
            id: `order-pending-${o.id}`,
            kind: "order",
            title: "Pagamento pendente",
            description: "Finalize o PIX para liberar seu acesso automaticamente.",
            createdAt: o.created_at,
            href: "/dashboard",
          });
        }
      }
    }

    for (const m of migrations.data ?? []) {
      if (m.status && m.status !== "pending") {
        out.push({
          id: `mig-${m.id}-${m.status}`,
          kind: "migration",
          title: m.status === "approved" ? "Migração aprovada" : m.status === "rejected" ? "Migração recusada" : "Migração atualizada",
          description: "Acompanhe os detalhes na página de migração.",
          createdAt: m.updated_at,
          href: "/migracao",
        });
      }
    }

    out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { isAdmin, items: out.slice(0, 30) };
  });
