// Cron endpoint hit by pg_cron every day. Revokes licenses whose server
// renewal (dia 20) is overdue and best-effort suspends them in Yaarsa.
//
// Auth: Supabase anon key in the `apikey` header (canonical /api/public/*
// pattern) plus the DB-level SQL function `revoke_unpaid_server_licenses`
// which is REVOKEd from anon/authenticated and only callable via the
// service role from inside this handler.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-license-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Aceita Bearer (usado pelo orquestrador diário e pela Vercel) ou
        // x-cron-secret, e tanto CRON_SECRET quanto CRON_TRIGGER_TOKEN.
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { suspendAccountAnyPanel, yesterdayYmd } = await import("@/lib/license-cron.server");

        const { data: affected, error } = await supabaseAdmin
          .rpc("revoke_unpaid_server_licenses");
        if (error) {
          await supabaseAdmin.from("integration_logs").insert({
            source: "auto-revoke", action: "cron", outcome: "sql_error",
            error: error.message,
          } as any);
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }

        const list = (affected ?? []) as Array<{ id: string; user_id: string; yaarsa_email: string; panel: string | null }>;
        const yesterday = yesterdayYmd();

        let ySuspended = 0;
        const perLicenseRows: any[] = [];
        for (const l of list) {
          // Procura a conta no painel gravado e, se não estiver lá, nos demais
          // (v455 semanal, v457, v46) antes de dar a suspensão como perdida.
          const res = await suspendAccountAnyPanel(l.yaarsa_email, l.panel, yesterday);
          const suspended = res.status === "done";
          if (suspended) ySuspended++;
          perLicenseRows.push({
            source: "auto-revoke",
            action: "revoke_license",
            outcome: suspended
              ? "revoked"
              : res.status === "missing" ? "revoked_account_absent" : "revoked_yaarsa_failed",
            error: res.error,
            context: {
              license_id: l.id,
              user_id: l.user_id,
              yaarsa_email: l.yaarsa_email,
              panel: res.panel ?? l.panel,
              panels_tried: res.tried,
              reason: "server_overdue_day20",
              suspended_until: yesterday,
            } as any,
          });
        }

        if (perLicenseRows.length) {
          await supabaseAdmin.from("integration_logs").insert(perLicenseRows as any);
        }

        await supabaseAdmin.from("integration_logs").insert({
          source: "auto-revoke", action: "cron", outcome: "success",
          context: { revoked: list.length, yaarsa_suspended: ySuspended } as any,
        } as any);


        return Response.json({ ok: true, revoked: list.length, yaarsa_suspended: ySuspended });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
