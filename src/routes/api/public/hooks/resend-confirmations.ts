import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Reenvio automático do e-mail de confirmação (server-side).
 *
 * Roda por cron, independente do cliente ter a página aberta. Procura contas
 * criadas recentemente que ainda não confirmaram o e-mail e reenvia a
 * confirmação, com limite de tentativas e intervalo mínimo entre elas.
 *
 * Auth: Bearer CRON_TRIGGER_TOKEN.
 */
const MAX_ATTEMPTS = 3;
const MIN_INTERVAL_MIN = 30; // intervalo mínimo entre reenvios por usuário
const MAX_AGE_DAYS = 7; // não insiste em contas antigas
const BATCH = 25; // reenvios por execução (evita estourar limite de envio)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/hooks/resend-confirmations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const siteUrl = (process.env.SITE_URL ?? "https://www.shadowdashstore.com").replace(/\/+$/, "");
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabasePublic = createClient(process.env.SUPABASE_URL!, publishable, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (publishable.startsWith("sb_") && h.get("Authorization") === `Bearer ${publishable}`) {
                h.delete("Authorization");
              }
              h.set("apikey", publishable);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        // 1) Contas recentes ainda não confirmadas.
        const minCreated = Date.now() - MAX_AGE_DAYS * 86400_000;
        const pending: { id: string; email: string }[] = [];
        for (let page = 1; page <= 10 && pending.length < 200; page++) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
          if (error) return json({ error: error.message }, 500);
          const users = data?.users ?? [];
          for (const u of users) {
            if (!u.email) continue;
            if ((u as any).email_confirmed_at || (u as any).confirmed_at) continue;
            if (new Date(u.created_at).getTime() < minCreated) continue;
            pending.push({ id: u.id, email: u.email });
          }
          if (users.length < 200) break;
        }

        if (pending.length === 0) return json({ ok: true, checked: 0, sent: 0 });

        // 2) Estado de tentativas.
        const { data: rows } = await supabaseAdmin
          .from("email_confirm_retries")
          .select("user_id, attempts, last_attempt_at, done")
          .in("user_id", pending.map((p) => p.id));
        const byUser = new Map((rows ?? []).map((r: any) => [r.user_id, r]));

        const cutoff = Date.now() - MIN_INTERVAL_MIN * 60_000;
        let sent = 0;
        let skipped = 0;
        const failures: string[] = [];

        for (const user of pending) {
          if (sent >= BATCH) break;
          const state = byUser.get(user.id);
          if (state?.done) { skipped++; continue; }
          if ((state?.attempts ?? 0) >= MAX_ATTEMPTS) { skipped++; continue; }
          if (state?.last_attempt_at && new Date(state.last_attempt_at).getTime() > cutoff) { skipped++; continue; }

          const { error } = await supabasePublic.auth.resend({
            type: "signup",
            email: user.email,
            options: { emailRedirectTo: siteUrl },
          });

          const attempts = (state?.attempts ?? 0) + (error ? 0 : 1);
          await supabaseAdmin.from("email_confirm_retries").upsert(
            {
              user_id: user.id,
              email: user.email,
              attempts,
              last_attempt_at: new Date().toISOString(),
              done: attempts >= MAX_ATTEMPTS,
              last_error: error?.message ?? null,
            },
            { onConflict: "user_id" },
          );

          if (error) {
            failures.push(error.message);
            // Envio instável / limite: para o lote e tenta na próxima execução.
            if (/rate|limit/i.test(error.message)) break;
          } else {
            sent++;
          }
        }

        return json({ ok: true, checked: pending.length, sent, skipped, failures: failures.slice(0, 5) });
      },
    },
  },
});
