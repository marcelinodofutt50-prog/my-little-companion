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
        const provided = request.headers.get("x-cron-secret") || "";
        const expected = process.env.CRON_TRIGGER_TOKEN || "";
        if (!expected || provided.length !== expected.length || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { yaarsaRemoveAccount } = await import("@/lib/yaarsa.server");

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("licenses")
          .select("id, user_id, plan_slug, is_trial, yaarsa_email, panel, disabled_at, revoked, expires_at")
          .is("disabled_at", null)
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

        let removed = 0;
        const logs: any[] = [];
        for (const l of rows) {
          const panel = (l.panel === "v46" ? "v46" : "v457") as "v457" | "v46";
          let ok = false;
          let err: string | null = null;
          try {
            const r = await yaarsaRemoveAccount(l.yaarsa_email, panel);
            if (!r.Fail || /not.*found|inexist|1005/i.test(r.Fail)) ok = true;
            else err = String(r.Fail);
          } catch (e: any) { err = e?.message || "yaarsa_exception"; }

          // Sempre marca no banco (mesmo se painel falhou): a licença venceu.
          // Se o painel falhar, ficará no log e podemos reprocessar depois.
          await supabaseAdmin.from("licenses").update({
            disabled_at: nowIso,
            revoked: true,
          }).eq("id", l.id);

          if (ok) removed++;
          logs.push({
            source: "auto-expire",
            action: "expire_license",
            outcome: ok ? "removed" : "removed_yaarsa_failed",
            error: err,
            context: {
              license_id: l.id, user_id: l.user_id, plan_slug: l.plan_slug,
              is_trial: l.is_trial, yaarsa_email: l.yaarsa_email, panel,
              expired_at: l.expires_at,
            } as any,
          });
        }
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
