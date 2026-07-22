import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Você é o "Shadow Ops", assistente operacional do painel admin da Shadow (plataforma de licenças BTMOB/Shadow via API Yaarsa).

CONHECIMENTO DO FLUXO:
- Planos: login-7d (semanal), login-monthly (mensal, versão 4.5.7), login-lifetime (vitalício, versão 4.6).
- Servidor: taxa mensal R$450 (R$250 para clientes antigos/legacy) vence todo dia 20.
- Se não pagar até dia 20 → cron diário revoga a licença no Yaarsa (revoked=true, server_overdue_at setado).
- Reativação: quando o cliente paga, o webhook do Mercado Pago chama reactivate_server_licenses_for_user() e restaura via yaarsaExtend.
- Trial: 1 dia grátis por conta, criado via yaarsaCreateAccount.
- Credenciais Yaarsa: username 5 chars lowercase, password aleatório, armazenadas cifradas.
- Erros comuns: HTTP 403 (firewall Yaarsa), credencial duplicada, expiração inconsistente entre banco e Yaarsa.

REGRAS:
- SEMPRE use as ferramentas para inspecionar dados reais antes de responder. Nunca invente números.
- Ao detectar problema, proponha a correção e execute usando as tools (elas já rodam com privilégio admin).
- Após executar ação, confirme o resultado.
- Responda em português, direto, formato markdown com bullets curtos.
- Nunca exponha a service_role key, YAARSA_ADMIN_KEY, ou senhas em texto puro além do necessário.
- Nunca revogue/estenda em massa sem o admin pedir explicitamente.`;

async function requireAdmin(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { error: new Response("Unauthorized", { status: 401 }) };
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return { error: new Response("Unauthorized", { status: 401 }) };
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (!isAdmin) return { error: new Response("Forbidden", { status: 403 }) };
  return { userId: u.user.id };
}

export const Route = createFileRoute("/api/chat/license-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireAdmin(request);
        if (gate.error) return gate.error;

        const { messages } = (await request.json()) as { messages: UIMessage[] };
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const yaarsa = await import("@/lib/yaarsa.server");

        const tools = {
          listLicenses: tool({
            description: "Lista licenças. Filtros opcionais: revoked, expiring_days (vence em N dias), user_email, limit.",
            inputSchema: z.object({
              revoked: z.boolean().nullable().optional(),
              expiring_days: z.number().nullable().optional(),
              user_email: z.string().nullable().optional(),
              limit: z.number().nullable().optional(),
            }),
            execute: async ({ revoked, expiring_days, user_email, limit }) => {
              let q = supabaseAdmin.from("licenses").select("id,user_id,yaarsa_email,plan_slug,version_tier,is_legacy,is_trial,revoked,disabled_at,expires_at,server_paid_until,server_overdue_at,created_at").order("created_at", { ascending: false }).limit(limit ?? 50);
              if (typeof revoked === "boolean") q = q.eq("revoked", revoked);
              if (user_email) {
                const { data: p } = await supabaseAdmin.from("profiles").select("id").ilike("email", `%${user_email}%`).maybeSingle();
                if (p) q = q.eq("user_id", p.id);
                else return { count: 0, items: [], note: "Nenhum profile com esse email." };
              }
              const { data, error } = await q;
              if (error) return { error: error.message };
              let items = data ?? [];
              if (typeof expiring_days === "number") {
                const cut = Date.now() + expiring_days * 86400000;
                items = items.filter((l: any) =>
                  (l.expires_at && new Date(l.expires_at).getTime() < cut) ||
                  (l.server_paid_until && new Date(l.server_paid_until).getTime() < cut)
                );
              }
              return { count: items.length, items };
            },
          }),

          getLicense: tool({
            description: "Retorna detalhes completos de uma licença por ID.",
            inputSchema: z.object({ licenseId: z.string().uuid() }),
            execute: async ({ licenseId }) => {
              const { data, error } = await supabaseAdmin.from("licenses").select("*").eq("id", licenseId).maybeSingle();
              if (error) return { error: error.message };
              if (!data) return { error: "Licença não encontrada" };
              return data;
            },
          }),

          systemHealth: tool({
            description: "Retorna estatísticas do sistema: total de licenças, ativas, revogadas, vencendo, receita e integrações recentes com erro.",
            inputSchema: z.object({}),
            execute: async () => {
              const [{ count: total }, { count: revoked }, { count: users }, { data: orders }, { data: recentErrors }] = await Promise.all([
                supabaseAdmin.from("licenses").select("*", { count: "exact", head: true }),
                supabaseAdmin.from("licenses").select("*", { count: "exact", head: true }).eq("revoked", true),
                supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
                supabaseAdmin.from("orders").select("amount").eq("status", "paid"),
                supabaseAdmin.from("integration_logs").select("source,action,http_status,error,created_at").neq("outcome", "success").order("created_at", { ascending: false }).limit(10),
              ]);
              const revenue = (orders ?? []).reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
              return {
                totals: { licenses: total, revoked, active: (total ?? 0) - (revoked ?? 0), users, revenue_brl: revenue },
                recent_errors: recentErrors,
              };
            },
          }),

          checkYaarsa: tool({
            description: "Verifica se a conta Yaarsa da licença está sincronizada (tenta reautenticar).",
            inputSchema: z.object({ licenseId: z.string().uuid() }),
            execute: async ({ licenseId }) => {
              const { data: lic } = await supabaseAdmin.from("licenses").select("yaarsa_email,expires_at,revoked,disabled_at").eq("id", licenseId).maybeSingle();
              if (!lic) return { error: "Licença não encontrada" };
              const r = await yaarsa.yaarsaExtend(lic.yaarsa_email, (lic.expires_at ?? new Date().toISOString()).slice(0, 10));
              return { yaarsa_email: lic.yaarsa_email, ok: !r.Fail, success: r.Success ?? null, fail: r.Fail ?? null };
            },
          }),


          extendLicense: tool({
            description: "Estende a data de expiração de uma licença em N dias (também sincroniza no Yaarsa).",
            inputSchema: z.object({ licenseId: z.string().uuid(), days: z.number().int().min(1).max(3650) }),
            execute: async ({ licenseId, days }) => {
              const { data: lic } = await supabaseAdmin.from("licenses").select("id,yaarsa_email,expires_at").eq("id", licenseId).maybeSingle();
              if (!lic) return { error: "Licença não encontrada" };
              const base = lic.expires_at ? new Date(lic.expires_at) : new Date();
              base.setDate(base.getDate() + days);
              const iso = base.toISOString();
              await supabaseAdmin.from("licenses").update({ expires_at: iso, revoked: false }).eq("id", licenseId);
              const y = await yaarsa.yaarsaExtend(lic.yaarsa_email, iso.slice(0, 10));
              return { new_expires_at: iso, yaarsa_ok: !y.Fail, yaarsa_result: y.Success ?? y.Fail };
            },
          }),

          renewServer: tool({
            description: "Renova o servidor (server_paid_until) até o próximo dia 20, remove overdue, reativa no Yaarsa.",
            inputSchema: z.object({ licenseId: z.string().uuid() }),
            execute: async ({ licenseId }) => {
              const { data: lic } = await supabaseAdmin.from("licenses").select("id,yaarsa_email,expires_at").eq("id", licenseId).maybeSingle();
              if (!lic) return { error: "Licença não encontrada" };
              const d = new Date();
              const next20 = new Date(d.getFullYear(), d.getMonth(), 20);
              if (d.getDate() >= 20) next20.setMonth(next20.getMonth() + 1);
              const iso = next20.toISOString();
              await supabaseAdmin.from("licenses").update({
                server_paid_until: iso.slice(0, 10),
                server_overdue_at: null,
                revoked: false,
              }).eq("id", licenseId);
              const y = await yaarsa.yaarsaExtend(lic.yaarsa_email, (lic.expires_at ?? iso).slice(0, 10));
              return { server_paid_until: iso.slice(0, 10), yaarsa_ok: !y.Fail };
            },
          }),

          revokeLicense: tool({
            description: "Revoga uma licença (bloqueia acesso). Só use quando o admin pedir explicitamente.",
            inputSchema: z.object({ licenseId: z.string().uuid(), reason: z.string().min(3) }),
            execute: async ({ licenseId, reason }) => {
              await supabaseAdmin.from("licenses").update({ revoked: true, disabled_at: new Date().toISOString() }).eq("id", licenseId);
              await supabaseAdmin.from("integration_logs").insert({
                source: "admin-ai", action: "revoke", outcome: "success",
                context: { license_id: licenseId, reason } as any,
              });

              return { ok: true, reason };
            },
          }),

          scanIssues: tool({
            description: "Varredura: retorna licenças com problemas (vencidas mas não revogadas, sem yaarsa_email, server_overdue_at antigo, expires_at inconsistente).",
            inputSchema: z.object({}),
            execute: async () => {
              const { data: all } = await supabaseAdmin.from("licenses").select("id,user_id,yaarsa_email,expires_at,server_paid_until,server_overdue_at,revoked,disabled_at,plan_slug,is_trial");
              const now = Date.now();
              const problems: any[] = [];
              for (const l of all ?? []) {
                if (!l.yaarsa_email) problems.push({ id: l.id, issue: "sem yaarsa_email" });
                if (!l.revoked && l.expires_at && new Date(l.expires_at).getTime() < now) problems.push({ id: l.id, issue: "expires_at no passado, licença ainda ativa", expires_at: l.expires_at });
                if (l.server_overdue_at && !l.revoked) problems.push({ id: l.id, issue: "server_overdue_at setado mas licença não revogada", server_overdue_at: l.server_overdue_at });
                if (!l.revoked && l.server_paid_until && new Date(l.server_paid_until).getTime() < now - 5 * 86400000) problems.push({ id: l.id, issue: "server_paid_until vencido há mais de 5 dias", server_paid_until: l.server_paid_until });
              }
              return { total_licenses: all?.length ?? 0, problems: problems.slice(0, 100), problem_count: problems.length };
            },
          }),

          recentLogs: tool({
            description: "Últimos logs de integração (Yaarsa/Mercado Pago). Filtro opcional: only_errors.",
            inputSchema: z.object({ only_errors: z.boolean().nullable().optional(), limit: z.number().nullable().optional() }),
            execute: async ({ only_errors, limit }) => {
              let q = supabaseAdmin.from("integration_logs").select("source,action,http_status,outcome,error,created_at,url").order("created_at", { ascending: false }).limit(limit ?? 30);
              if (only_errors) q = q.neq("outcome", "success");

              const { data } = await q;
              return data ?? [];
            },
          }),
        };

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-2.5-flash"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
