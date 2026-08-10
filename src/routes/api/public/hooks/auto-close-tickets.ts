import { createFileRoute } from "@tanstack/react-router";

/**
 * Fecha automaticamente tickets de suporte parados.
 *
 * Regra: se o ticket está aberto (ou em andamento) e a última mensagem
 * — de cliente ou de suporte — tem mais de 5 horas, o ticket é encerrado
 * e uma mensagem de sistema é registrada na conversa. O cliente pode
 * abrir uma nova conversa a qualquer momento.
 *
 * Auth: Bearer CRON_TRIGGER_TOKEN.
 */
const IDLE_HOURS = 5;

export const Route = createFileRoute("/api/public/hooks/auto-close-tickets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - IDLE_HOURS * 3600_000).toISOString();

        const { data: threads, error } = await supabaseAdmin
          .from("support_threads")
          .select("id, user_id, status, created_at, updated_at, last_customer_message_at, last_staff_message_at")
          .neq("status", "closed")
          .limit(500);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const stale = (threads ?? []).filter((t) => {
          const stamps = [t.last_customer_message_at, t.last_staff_message_at, t.updated_at, t.created_at]
            .filter(Boolean)
            .map((s) => new Date(s as string).getTime())
            .filter((n) => Number.isFinite(n));
          if (!stamps.length) return false;
          return Math.max(...stamps) < new Date(cutoff).getTime();
        });

        let closed = 0;
        for (const t of stale) {
          const { error: upErr } = await supabaseAdmin
            .from("support_threads")
            .update({
              status: "closed",
              closed_at: new Date().toISOString(),
              closed_by_name: "Sistema (inatividade)",
              unread_by_staff: 0,
            })
            .eq("id", t.id)
            .neq("status", "closed");
          if (upErr) continue;
          closed++;
          await supabaseAdmin.from("support_messages").insert({
            thread_id: t.id,
            sender_id: t.user_id,
            is_admin: true,
            is_system: true,
            body: `Ticket encerrado automaticamente por inatividade (${IDLE_HOURS}h sem mensagens). Se ainda precisar de ajuda, é só enviar uma nova mensagem que abrimos outro atendimento.`,
          });
        }

        return new Response(JSON.stringify({ checked: threads?.length ?? 0, closed }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
