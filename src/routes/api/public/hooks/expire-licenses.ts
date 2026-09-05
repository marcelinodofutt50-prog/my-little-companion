// Cron endpoint (a cada 15 min) que fecha licenças cujo expires_at já passou.
// BMob invalida logins à meia-noite, então criamos a conta no Yaarsa com
// +1 dia de buffer e cortamos aqui, na hora exata do expires_at persistido.
//
// Regras:
//  - trial            -> remove a conta do Yaarsa de vez.
//  - login-7d/30d/etc -> remove a conta do Yaarsa (o cliente precisa renovar).
//  - login-lifetime   -> nunca vence por este cron (expires_at é +20 anos).
//  - disabled_at != null ou revoked = true (por atraso de servidor) -> pula.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/expire-licenses")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Aceita Bearer (usado pelo orquestrador diário e pela Vercel) ou
        // x-cron-secret, e tanto CRON_SECRET quanto CRON_TRIGGER_TOKEN.
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { removeAccountAnyPanel } = await import("@/lib/license-cron.server");

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("licenses")
          .select("id, user_id, plan_slug, is_trial, yaarsa_email, panel, disabled_at, revoked, expires_at")
          .is("disabled_at", null)
          .is("revoked", false)
          .neq("plan_slug", "login-lifetime")
          .lt("expires_at", nowIso)
          .limit(200);

        if (error) {
          await supabaseAdmin.from("integration_logs").insert({
            source: "auto-expire", action: "cron", outcome: "sql_error", error: error.message,
          } as any);
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }

        const rows = (due ?? []) as Array<{
          id: string; user_id: string; plan_slug: string; is_trial: boolean;
          yaarsa_email: string; panel: string | null; expires_at: string;
        }>;

        // Reprocessa remoções que falharam nas rodadas anteriores (painel fora do ar):
        // sem isso o cliente continuava logando mesmo com a licença vencida no site.
        const retryCutoff = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: stuck } = await supabaseAdmin
          .from("licenses")
          .select("id, user_id, plan_slug, is_trial, yaarsa_email, panel, expires_at")
          .not("disabled_at", "is", null)
          .neq("plan_slug", "login-lifetime")
          .gte("disabled_at", retryCutoff)
          .lt("expires_at", nowIso)
          .limit(50);

        const pendingRows = ((stuck ?? []) as typeof rows).filter(
          (s) => !rows.some((r) => r.id === s.id),
        );

        let removed = 0;
        let pendingPanel = 0;
        const logs: any[] = [];

        const processRemoval = async (l: (typeof rows)[number], retry: boolean) => {
          const res = await removeAccountAnyPanel(l.yaarsa_email, l.panel);
          const ok = res.status === "done" || res.status === "missing";

          if (!retry) {
            // A licença venceu: fecha no banco mesmo que o painel esteja fora do ar.
            await supabaseAdmin.from("licenses").update({
              disabled_at: nowIso,
              revoked: true,
            }).eq("id", l.id);
          }

          if (ok) removed++;
          else pendingPanel++;

          logs.push({
            source: "auto-expire",
            action: retry ? "expire_license_retry" : "expire_license",
            outcome: ok
              ? res.status === "missing" ? "already_absent" : "removed"
              : "removed_yaarsa_failed",
            error: res.error,
            context: {
              license_id: l.id, user_id: l.user_id, plan_slug: l.plan_slug,
              is_trial: l.is_trial, yaarsa_email: l.yaarsa_email,
              panel: res.panel ?? l.panel, panels_tried: res.tried,
              expired_at: l.expires_at,
            } as any,
          });
        };

        for (const l of rows) await processRemoval(l, false);
        for (const l of pendingRows) await processRemoval(l, true);

        if (logs.length) await supabaseAdmin.from("integration_logs").insert(logs as any);


        await supabaseAdmin.from("integration_logs").insert({
          source: "auto-expire", action: "cron", outcome: "success",
          context: { checked: rows.length, removed } as any,
        } as any);

        return Response.json({ ok: true, checked: rows.length, removed });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
