// Cron a cada 3 dias — a IA/rotina automática verifica os clientes que
// pagam o servidor "por fora" do site. Para cada licença marcada como
// `paid_externally = true`:
//
//   1. Reafirma o `expire_date` no painel Yaarsa (v457 ou v46) para bater
//      exatamente com `paid_externally_until`. Isso garante que nenhum
//      drift no painel derrube o cliente antes da data combinada.
//   2. Atualiza `paid_externally_last_check_at` + `..._status` para o admin
//      acompanhar visualmente na aba "Externos".
//   3. Se `paid_externally_until` já passou, marca como `expired` e limpa
//      o flag — na próxima virada do dia 20 o cron principal revoga.
//
// Auth: mesmo header `x-cron-secret` usado pelo cron diário.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/verify-external-payers")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret") || "";
        const expected = process.env.CRON_TRIGGER_TOKEN || "";
        if (!expected || provided.length !== expected.length || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { yaarsaExtend } = await import("@/lib/yaarsa.server");

        const { data: rows, error } = await supabaseAdmin
          .from("licenses")
          .select("id, user_id, yaarsa_email, panel, paid_externally_until, disabled_at, revoked")
          .eq("paid_externally", true)
          .is("disabled_at", null)
          .limit(1000);
        if (error) {
          await supabaseAdmin.from("integration_logs").insert({
            source: "external-payer", action: "cron", outcome: "sql_error",
            error: error.message,
          } as any);
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }

        const list = (rows ?? []) as Array<{
          id: string; user_id: string; yaarsa_email: string; panel: string | null;
          paid_externally_until: string | null; revoked: boolean;
        }>;
        const today = new Date().toISOString().slice(0, 10);
        const logRows: any[] = [];
        let aligned = 0, expired = 0, failed = 0;

        for (const l of list) {
          const nowIso = new Date().toISOString();
          if (!l.paid_externally_until) {
            await supabaseAdmin.from("licenses").update({
              paid_externally_last_check_at: nowIso,
              paid_externally_last_check_status: "missing_until",
            } as any).eq("id", l.id);
            continue;
          }

          // Se a data combinada já passou, encerra a marcação — o cron do
          // dia 20 cuida da revogação a partir daí.
          if (l.paid_externally_until < today) {
            await supabaseAdmin.from("licenses").update({
              paid_externally: false,
              paid_externally_last_check_at: nowIso,
              paid_externally_last_check_status: "expired",
            } as any).eq("id", l.id);
            logRows.push({
              source: "external-payer", action: "auto_verify", outcome: "expired",
              context: { license_id: l.id, until: l.paid_externally_until } as any,
            });
            expired++;
            continue;
          }

          const panel = (l.panel === "v46" ? "v46" : "v457") as "v457" | "v46";
          try {
            const r = await yaarsaExtend(l.yaarsa_email, l.paid_externally_until, panel);
            if (r.Fail) {
              await supabaseAdmin.from("licenses").update({
                paid_externally_last_check_at: nowIso,
                paid_externally_last_check_status: `yaarsa_fail:${String(r.Fail).slice(0, 60)}`,
              } as any).eq("id", l.id);
              logRows.push({
                source: "external-payer", action: "auto_verify", outcome: "yaarsa_fail",
                error: String(r.Fail),
                context: { license_id: l.id, panel, until: l.paid_externally_until } as any,
              });
              failed++;
            } else {
              await supabaseAdmin.from("licenses").update({
                paid_externally_last_check_at: nowIso,
                paid_externally_last_check_status: "aligned",
                expires_at: new Date(`${l.paid_externally_until}T23:59:59`).toISOString(),
                server_paid_until: new Date(`${l.paid_externally_until}T23:59:59`).toISOString(),
                revoked: false, server_overdue_at: null,
              } as any).eq("id", l.id);
              aligned++;
            }
          } catch (e: any) {
            await supabaseAdmin.from("licenses").update({
              paid_externally_last_check_at: nowIso,
              paid_externally_last_check_status: `exception:${String(e?.message || e).slice(0, 60)}`,
            } as any).eq("id", l.id);
            logRows.push({
              source: "external-payer", action: "auto_verify", outcome: "exception",
              error: String(e?.message || e),
              context: { license_id: l.id } as any,
            });
            failed++;
          }
        }

        if (logRows.length) await supabaseAdmin.from("integration_logs").insert(logRows as any);

        await supabaseAdmin.from("integration_logs").insert({
          source: "external-payer", action: "cron", outcome: "success",
          context: { checked: list.length, aligned, expired, failed } as any,
        } as any);

        return Response.json({ ok: true, checked: list.length, aligned, expired, failed });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
