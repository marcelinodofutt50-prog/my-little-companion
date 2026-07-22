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
        const provided = request.headers.get("x-cron-secret") || "";
        const expected = process.env.CRON_TRIGGER_TOKEN || "";
        if (!expected || provided.length !== expected.length || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { yaarsaExtend } = await import("@/lib/yaarsa.server");

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
        const yesterday = (() => {
          const d = new Date(); d.setDate(d.getDate() - 1);
          return d.toISOString().slice(0, 10);
        })();

        let ySuspended = 0;
        const perLicenseRows: any[] = [];
        for (const l of list) {
          // Only site-registered clients reach this loop (rows come from public.licenses),
          // and we suspend each one in its own panel (v4.5.7 = 191, v4.6 = 200).
          const panel = (l.panel === "v46" ? "v46" : "v457") as "v457" | "v46";
          let suspended = false;
          let yaarsaError: string | null = null;
          try {
            const r = await yaarsaExtend(l.yaarsa_email, yesterday, panel);
            if (!r.Fail) { ySuspended++; suspended = true; }
            else yaarsaError = String(r.Fail || "yaarsa_fail");
          } catch (e: any) { yaarsaError = e?.message || "yaarsa_exception"; }
          perLicenseRows.push({
            source: "auto-revoke",
            action: "revoke_license",
            outcome: suspended ? "revoked" : "revoked_yaarsa_failed",
            error: yaarsaError,
            context: {
              license_id: l.id,
              user_id: l.user_id,
              yaarsa_email: l.yaarsa_email,
              panel,
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
