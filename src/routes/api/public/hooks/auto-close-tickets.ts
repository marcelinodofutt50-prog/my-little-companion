import { canAutoCloseSupport, type ResolutionMessage } from "@/lib/support-renewal-rules";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Fecha somente atendimentos com resolução confirmada pelo cliente.
 *
 * Regra: confirmação explícita, cinco horas sem mensagens e nenhuma
 * pendência de pagamento ou entrega. Silêncio não significa resolução.
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
          const [messages, pending, crypto] = await Promise.all([
            supabaseAdmin.from("support_messages").select("body, is_admin, is_system, created_at")
              .eq("thread_id", t.id).order("created_at", { ascending: false }).limit(30),
            supabaseAdmin.from("orders").select("id").eq("user_id", t.user_id)
              .in("status", ["pending", "created", "processing", "yaarsa_failed"]).limit(1),
            supabaseAdmin.from("crypto_payments").select("id").eq("user_id", t.user_id)
              .in("status", ["pending", "confirmed", "failed"]).limit(1),
          ]);
          // Fail closed when any evidence cannot be read.
          if (messages.error || pending.error || crypto.error) continue;
          if (!canAutoCloseSupport((messages.data ?? []) as ResolutionMessage[],
            !!pending.data?.length || !!crypto.data?.length)) continue;

          const { data: updated, error: upErr } = await supabaseAdmin
            .from("support_threads")
            .update({
              status: "closed",
              closed_at: new Date().toISOString(),
              closed_by_name: "Sistema (resolução confirmada)",
              unread_by_staff: 0,
            })
            .eq("id", t.id)
            .neq("status", "closed")
            .eq("updated_at", t.updated_at)
            .select("id").maybeSingle();
          if (upErr || !updated) continue;
          closed++;
          await supabaseAdmin.from("support_messages").insert({
            thread_id: t.id,
            sender_id: t.user_id,
            is_admin: true,
            is_system: true,
            body: `Atendimento encerrado após confirmação da resolução e ${IDLE_HOURS}h sem novas mensagens. Se ainda precisar de ajuda, é só enviar uma nova mensagem que abrimos outro atendimento.`,
          });
        }

        await supabaseAdmin.from("integration_logs").insert({
          source: "support", action: "auto-close-tickets", outcome: "success",
          context: { checked: threads?.length ?? 0, stale: stale.length, closed },
        } as never).then(() => undefined, () => undefined);

        return new Response(JSON.stringify({ checked: threads?.length ?? 0, closed }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
