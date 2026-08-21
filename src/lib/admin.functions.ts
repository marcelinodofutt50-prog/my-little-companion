import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tierFromPlanSlug, type VersionTier } from "@/lib/plans";
import { createGeminiProvider } from "./gemini-provider.server";
import { assertAdmin, assertStaff, resolveOrInviteUser } from "@/lib/admin-helpers.server";
import { computeExpiries, nextDay20, nextDay20Date, CreateLicenseInput, RegisterLegacyInput } from "@/lib/admin-shared";
import { trackSchemaFailure } from "./tutorials.functions";


export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await assertStaff(context);
      const { data, error } = await context.supabase
        .from("profiles")
        .select("id,email,full_name,display_name,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return data ?? [];
    } catch (err: any) {
      console.error("[ADMIN_ERR] listUsers:", err);
      throw err;
    }
  });


export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await assertStaff(context);
      const { data, error } = await context.supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      if (ids.length === 0) return rows.map((r: any) => ({ ...r, profile: null }));
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,email,full_name,display_name").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return rows.map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
    } catch (err: any) {
      console.error("[ADMIN_ERR] listOrders:", err);
      throw err;
    }
  });


export const adminListLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await assertStaff(context);
      const { data, error } = await context.supabase.from("licenses").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      if (ids.length === 0) return rows.map((r: any) => ({ ...r, profile: null }));
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,email,full_name,display_name").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return rows.map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
    } catch (err: any) {
      console.error("[ADMIN_ERR] listLicenses:", err);
      throw err;
    }
  });


export const adminRevokeLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { yaarsaRemoveAccount } = await import("./yaarsa.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lic } = await supabaseAdmin
      .from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");

    // Se o painel estiver fora do ar, a revogação local não pode ficar presa:
    // registramos a falha e seguimos bloqueando o acesso aqui.
    let panelRemoved = true;
    let panelError: string | null = null;
    try {
      const r: any = await yaarsaRemoveAccount(lic.yaarsa_email, (lic as any).panel ?? "v457");
      if (r?.Fail && !/1005|not found|não encontrado/i.test(String(r.Fail))) {
        panelRemoved = false;
        panelError = String(r.Fail);
      }
    } catch (e: any) {
      panelRemoved = false;
      panelError = String(e?.message ?? e);
    }

    // RLS na tabela de licenças só permite leitura: a escrita precisa do
    // cliente administrativo, senão a revogação virava um "sucesso" silencioso.
    const { error: revErr } = await supabaseAdmin
      .from("licenses")
      .update({ revoked: true, status: "revoked", disabled_at: new Date().toISOString() } as any)
      .eq("id", data.licenseId);
    if (revErr) throw new Error(revErr.message);

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${(lic as any).panel ?? "v457"}`,
      action: "admin_revoke_license",
      outcome: panelRemoved ? "success" : "partial",
      context: {
        license_id: (lic as any).id,
        actor_id: context.userId,
        panel_removed: panelRemoved,
        panel_error: panelError,
      } as any,
    } as any);

    return { ok: true, panelRemoved, panelError };

  });

export const adminExtendLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ licenseId: z.string().uuid(), newExpireDate: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { yaarsaExtend } = await import("./yaarsa.server");
    const { data: lic } = await context.supabase.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    const r = await yaarsaExtend(lic.yaarsa_email, data.newExpireDate, (lic as any).panel ?? "v457");
    if (r.Fail) throw new Error(r.Fail);

    // Estender a data no painel não bastava: o registro continuava aparecendo
    // como "inativo" porque `status` seguia expirado e o cron diário voltava a
    // revogar a licença enquanto `server_paid_until` estivesse no passado.
    const { nextDay20 } = await import("./admin-shared");
    const target = new Date(data.newExpireDate);
    const serverPaid = (lic as any).server_paid_until ? new Date((lic as any).server_paid_until) : null;
    const serverOverdue = !serverPaid || serverPaid.getTime() < Date.now();
    const patch: Record<string, unknown> = {
      expires_at: target.toISOString(),
      revoked: false,
      server_overdue_at: null,
      status: (lic as any).suspended_at ? (lic as any).status : "active",
    };
    if (serverOverdue) patch.server_paid_until = nextDay20().toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: extErr } = await supabaseAdmin
      .from("licenses").update(patch as any).eq("id", data.licenseId);
    if (extErr) throw new Error(extErr.message);
    return { ok: true, expires_at: target.toISOString(), server_paid_until: patch.server_paid_until ?? (lic as any).server_paid_until };
  });


/**
  * "Corrigir bug de erro" — procedimento manual usado quando o cliente não
  * consegue logar no BMob mesmo com a licença válida:
  *   1) Sincroniza a data de expiração real do banco para o painel Yaarsa;
  *   2) Reaplica a MESMA senha da conta (força o painel a regravar o registro);
  *   3) Garante que o painel e o banco estejam com a mesma data final.
  * Agora com verificação de integridade inclusa.
  */
export const adminFixLoginBug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { yaarsaExtend, yaarsaSetPassword, decrypt } = await import("./yaarsa.server");
    const { data: lic } = await context.supabase.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    if (lic.disabled_at) throw new Error("Esta licença está desativada — reative antes de corrigir.");
    if (!lic.yaarsa_email) throw new Error("Licença sem e-mail no painel");

    const panel = ((lic as any).panel ?? "v457") as "v457" | "v46";
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const original = lic.expires_at ? new Date(lic.expires_at) : null;
    const bumped = original ? new Date(original.getTime() + 24 * 60 * 60 * 1000) : null;
    const steps: { step: string; ok: boolean; message?: string }[] = [];
    let dateBumped = false;

    // 1) empurra a validade 1 dia (ex.: 20 → 21). Licença sem data (vitalícia)
    //    pula essa etapa para não inventar vencimento no painel.
    if (original && bumped) {
      const up = await yaarsaExtend(lic.yaarsa_email, ymd(bumped), panel);
      steps.push({ step: `validade → ${ymd(bumped)}`, ok: !up.Fail, message: up.Fail ?? up.Success });
      if (up.Fail) throw new Error(`Falha ao empurrar a data no painel: ${up.Fail}`);
      dateBumped = true;
    } else {
      steps.push({ step: "validade inalterada (licença sem vencimento)", ok: true });
    }

    // 2) reaplica exatamente a MESMA senha já entregue ao cliente
    let passOk = false;
    let passMsg = "";
    try {
      const plain = decrypt(lic.yaarsa_password_enc);
      const pw = await yaarsaSetPassword(lic.yaarsa_email, plain, panel, lic.yaarsa_username ?? undefined);
      passOk = !pw.Fail;
      passMsg = String(pw.Fail ?? pw.Success ?? "");
      steps.push({ step: "senha reaplicada", ok: passOk, message: passMsg });
    } catch (e) {
      passMsg = String((e as Error)?.message || e);
      steps.push({ step: "senha reaplicada", ok: false, message: passMsg });
    }

    // 3) volta para a data original (sempre tenta, mesmo se a senha falhar)
    if (dateBumped && original) {
      const back = await yaarsaExtend(lic.yaarsa_email, ymd(original), panel);
      steps.push({ step: `validade → ${ymd(original)}`, ok: !back.Fail, message: back.Fail ?? back.Success });
      if (back.Fail) {
        throw new Error(`Atenção: a validade ficou em ${ymd(bumped!)} e não voltou para ${ymd(original)} — ${back.Fail}. Use "Estender manualmente" para corrigir a data.`);
      }
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("integration_logs").insert({
        source: `yaarsa-${panel}`, action: "admin_fix_login_bug",
        outcome: passOk ? "success" : "partial",
        error: passOk ? null : passMsg || null,
        context: { license_id: lic.id, user_id: lic.user_id, actor: context.userId, steps } as any,
      });
    } catch { /* best-effort */ }

    return {
      ok: true,
      passwordReapplied: passOk,
      expiresAt: original ? ymd(original) : null,
      steps,
    };
  });


export const adminAnalyzeLoginBug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: lic } = await context.supabase.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");

    const [profile, orders, logs] = await Promise.all([
      lic.user_id ? context.supabase.from("profiles").select("id,email,full_name,display_name,created_at").eq("id", lic.user_id).maybeSingle() : Promise.resolve({ data: null }),
      context.supabase.from("orders").select("id,status,amount,created_at,plan_slug").eq("user_id", lic.user_id).order("created_at", { ascending: false }).limit(5),
      context.supabase.from("integration_logs").select("action,created_at,outcome,error,context").eq("source", `yaarsa-${(lic as any).panel ?? "v46"}`).ilike("context->>license_id", data.licenseId).order("created_at", { ascending: false }).limit(10),
    ]);

    const expiresAt = lic.expires_at ? new Date(lic.expires_at).toISOString().slice(0, 10) : "sem vencimento";
    const isExpired = lic.expires_at ? new Date(lic.expires_at) < new Date() : false;
    const lastOrder = (orders.data ?? [])[0];
    const hasRecentPayment = lastOrder && lastOrder.status === "paid" && new Date(lastOrder.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFailures = (logs.data ?? []).filter((l: any) => l.outcome === "error" || l.outcome === "partial").slice(0, 3);

    const prompt = `Você é um técnico de suporte sênior da ShadowDash. Analise o caso abaixo de um cliente que não consegue logar no painel BTMob e explique, em 3-4 parágrafos curtos e diretos, quais são os fatores mais prováveis e a recomendação de ação. Responda em português do Brasil, tom profissional e objetivo, sem alarmismo.

Dados da licença:
- ID: ${lic.id}
- Painel: ${(lic as any).panel ?? "v46"}
- E-mail no painel: ${lic.yaarsa_email ?? "não configurado"}
- Usuário no painel: ${lic.yaarsa_username ?? "não configurado"}
- Vencimento: ${expiresAt} ${isExpired ? "(EXPIRADA)" : ""}
- Desativada em: ${lic.disabled_at ? new Date(lic.disabled_at).toISOString().slice(0, 10) : "não"}
- Revogada: ${lic.revoked ? "sim" : "não"}
- Criada em: ${lic.created_at ? new Date(lic.created_at).toISOString().slice(0, 10) : "—"}

Dados do cliente:
- E-mail: ${profile.data?.email ?? "—"}
- Nome: ${profile.data?.full_name ?? profile.data?.display_name ?? "—"}
- Cliente desde: ${profile.data?.created_at ? new Date(profile.data.created_at).toISOString().slice(0, 10) : "—"}

Pedidos recentes:
${(orders.data ?? []).map((o: any) => `- ${new Date(o.created_at).toISOString().slice(0, 10)} | ${o.status} | ${o.plan_slug ?? "—"} | R$ ${o.amount}`).join("\n") || "nenhum pedido"}

Falhas recentes de integração no painel:
${recentFailures.map((l: any) => `- ${new Date(l.created_at).toISOString().slice(0, 10)} | ${l.action} | ${l.outcome}${l.error ? ` | erro: ${l.error}` : ""}`).join("\n") || "nenhuma falha recente"}

Instrução final: Dê um diagnóstico com 3 fatores numerados (ex: 1. Vencimento não refletiu após pagamento, 2. Senha desincronizada, 3. Possível revogação/desativação) e uma conclusão dizendo se a correção automática (empurrar validade + reaplicar senha) é adequada ou se precisa de ação manual. Máximo 300 palavras.`;

    const model = createGeminiProvider("gemini-1.5-flash");
    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.2,
    });

    return {
      diagnosis: text,
      factors: [
        { label: "Vencimento", value: expiresAt, alert: isExpired },
        { label: "Pagamento recente", value: hasRecentPayment ? "sim" : "não", alert: !hasRecentPayment && isExpired },
        { label: "Licença ativa", value: lic.disabled_at || lic.revoked ? "não" : "sim", alert: !!(lic.disabled_at || lic.revoked) },
        { label: "Falhas recentes", value: `${recentFailures.length} no painel`, alert: recentFailures.length > 0 },
      ],
    };
  });


export const adminListThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    filter: z.enum(["open", "mine", "closed", "all"]).default("open"),
  }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { pickAdminClient } = await import("./admin-read.server");
    const { db } = await pickAdminClient(context.supabase);
    const columns =
      "id, user_id, subject, category, priority, status, created_at, updated_at, assigned_to, assigned_name, assigned_at, closed_at, closed_by_name, last_customer_message_at, last_staff_message_at, unread_by_staff, unread_by_customer";
    const run = async (cols: string) => {
      let q = db.from("support_threads").select(cols);
      if (data.filter === "open") q = q.neq("status", "closed");
      else if (data.filter === "mine") q = q.eq("assigned_to", context.userId).neq("status", "closed");
      else if (data.filter === "closed") q = q.eq("status", "closed");
      return q.order("updated_at", { ascending: false }).limit(300);
    };
    let { data: threads, error } = await run(columns);
    if (error) {
      // Cache de schema desatualizado (PGRST204/PGRST205) ou coluna nova ausente:
      // tenta de novo só com o essencial em vez de devolver lista vazia.
      console.warn("[adminListThreads] falha na query completa:", error.message);
      if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
        await trackSchemaFailure(error, "adminListThreads", false, { stage: "initial_fetch", filter: data.filter }, context.userId);
      }
      ({ data: threads, error } = await run("*"));
      if (error) throw new Error(`Não foi possível carregar as conversas: ${error.message}`);
      await trackSchemaFailure(error, "adminListThreads", true, { stage: "retry_minimal_success" }, context.userId);
    }
    const list = threads ?? [];
    const userIds = Array.from(new Set(list.map((t: any) => t.user_id).filter(Boolean)));
    const { data: profs } = userIds.length
      ? await db.from("profiles").select("id,email,full_name,display_name").in("id", userIds)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return list.map((t: any) => ({ ...t, profile: map.get(t.user_id) ?? null }));
  });

/**
 * Admin/moderador assume a conversa. Grava assigned_to + snapshot do nome,
 * insere uma mensagem de sistema visível ao cliente ("Ana do suporte
 * assumiu a conversa a partir daqui").
 */
export const adminAssumeThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ threadId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Tentativa de limpar cache de schema caso a coluna não seja encontrada
    try {
      if (supabaseAdmin && typeof (supabaseAdmin as any).rpc === 'function') {
        const { error: rpcErr } = await (supabaseAdmin as any).rpc("force_refresh_schema_permissions");
        if (rpcErr) console.warn("[admin] Schema refresh RPC error:", rpcErr);
      }
    } catch (e: any) {
      console.warn("[admin] Schema refresh attempt failed:", e);
    }

    const { data: me } = await supabaseAdmin
      .from("profiles").select("full_name,email").eq("id", context.userId).maybeSingle();
    const name = (me?.full_name?.trim() || me?.email?.split("@")[0] || "Suporte");
    await supabaseAdmin.from("support_threads").update({
      status: "assigned",
      assigned_to: context.userId,
      assigned_name: name,
      assigned_at: new Date().toISOString(),
    }).eq("id", data.threadId);
    await context.supabase.from("support_messages").insert({
      thread_id: data.threadId,
      sender_id: context.userId,
      is_admin: true,
      is_system: true,
      body: `🎧 ${name} assumiu a conversa a partir daqui.`,
    });
    return { ok: true, name };
  });

/**
 * Admin/moderador encerra a conversa. Insere mensagem de sistema e marca
 * status=closed. O cliente ainda vê o histórico e uma nova mensagem dele
 * abre uma nova thread automaticamente.
 */
export const adminCloseThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    reason: z.string().trim().max(200).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin
      .from("profiles").select("full_name,email").eq("id", context.userId).maybeSingle();
    const name = (me?.full_name?.trim() || me?.email?.split("@")[0] || "Suporte");
    await supabaseAdmin.from("support_threads").update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: context.userId,
      closed_by_name: name,
    }).eq("id", data.threadId);
    await context.supabase.from("support_messages").insert({
      thread_id: data.threadId,
      sender_id: context.userId,
      is_admin: true,
      is_system: true,
      body: `✅ Atendimento encerrado por ${name}${data.reason ? ` — ${data.reason}` : ""}. Envie uma nova mensagem para abrir outro atendimento.`,
    });
    return { ok: true };
  });


export const adminListThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    limit: z.number().int().min(5).max(100).optional(),
    before: z.string().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { pickAdminClient } = await import("./admin-read.server");
    const { db } = await pickAdminClient(context.supabase);
    const limit = data.limit ?? 30;
    let q = db
      .from("support_messages").select("*")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw new Error(`Não foi possível carregar as mensagens: ${error.message}`);
    const { normalizeSupportMessages } = await import("./support-message");
    const list = normalizeSupportMessages(rows, data.threadId);
    const hasMore = list.length > limit;
    const page = hasMore ? list.slice(0, limit) : list;
    return { messages: page.reverse(), hasMore };

  });


export const adminSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    body: z.string().trim().max(4000).optional().default(""),
    replyToId: z.string().uuid().optional().nullable(),
    attachmentPath: z.string().min(1).max(512).optional(),
    attachmentType: z.string().max(100).optional(),
  }).refine((v) => !!v.body?.trim() || !!v.attachmentPath, { message: "Mensagem vazia" }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    // Use the authenticated supabase client (not supabaseAdmin) so the
    // enforce_support_msg_admin_flag trigger sees auth.uid() = admin and
    // preserves is_admin=true. When inserted via service_role, auth.uid()
    // is NULL and the trigger forces is_admin=false, making replies appear
    // as if the client sent them.
    let attachmentUrl: string | null = null;
    if (data.attachmentPath) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from("support-media")
        .createSignedUrl(data.attachmentPath, 60 * 60 * 24 * 7);
      if (sErr) {
        console.error("[support] assinatura do anexo falhou:", sErr.message);
        throw new Error("Não foi possível anexar o arquivo: " + sErr.message);
      }
      attachmentUrl = signed?.signedUrl ?? null;
    }

    const payload: any = {
      thread_id: data.threadId,
      sender_id: context.userId,
      is_admin: true,
      body: data.body?.trim() ? data.body.trim() : null,
      attachment_url: attachmentUrl,
      attachment_type: data.attachmentType ?? null,
      reply_to_id: data.replyToId ?? null,
    };
    let { data: msg, error } = await context.supabase
      .from("support_messages")
      .insert(payload)
      .select("*")
      .single();

    // A cache de esquema pode ainda não conhecer reply_to_id logo após uma
    // migração. A resposta do suporte não deve falhar por uma coluna opcional.
    if (
      error &&
      (error.code === "PGRST204" || error.code === "42703" || String(error.message ?? "").includes("reply_to_id"))
    ) {

      const { reply_to_id: _replyToId, ...fallbackPayload } = payload;
      const retry = await context.supabase
        .from("support_messages")
        .insert(fallbackPayload)
        .select("*")
        .single();
      msg = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("[support] resposta do admin falhou:", error.code, error.message, error.details);
      if (error.code === "42501") {
        throw new Error("Permissão negada ao gravar a resposta (GRANT/RLS em support_messages).");
      }
      throw new Error(`Não foi possível enviar a resposta (${error.code || "erro"}): ${error.message}`);
    }
    if (!msg) throw new Error("Não foi possível enviar a resposta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("support_threads").update({ updated_at: new Date().toISOString() }).eq("id", data.threadId);
    const { normalizeSupportMessage } = await import("./support-message");
    return normalizeSupportMessage(msg, data.threadId);

  });


export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { count: users } = await context.supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: licenses } = await context.supabase.from("licenses").select("*", { count: "exact", head: true }).eq("revoked", false);
    const { data: paid } = await context.supabase.from("orders").select("amount").eq("status", "paid");
    const revenue = (paid ?? []).reduce((s, r) => s + Number(r.amount), 0);
    return { users: users ?? 0, licenses: licenses ?? 0, revenue };
  });

// ---- Staff management ----
export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    userId: z.string().uuid(),
    role: z.enum(["admin", "moderator", "user"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Wipe existing roles, then insert the new one
    const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (del.error) throw new Error(`Falha ao limpar papéis: ${del.error.message}`);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    // Confirma que gravou de verdade (evita "promovi mas continua cliente").
    const { data: check } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.userId).maybeSingle();
    if (check?.role !== data.role) throw new Error("O papel não foi salvo. Tente novamente.");
    return { ok: true, role: data.role };
  });

/**
 * Promove/rebaixa alguém pelo e-mail — evita depender da lista de usuários
 * (que pode estar paginada/filtrada) na hora de liberar um atendente.
 */
export const adminSetRoleByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    email: z.string().trim().email().max(200),
    role: z.enum(["admin", "moderator", "user"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("id,email").ilike("email", email).maybeSingle();
    if (!prof) throw new Error("Nenhuma conta encontrada com esse e-mail.");
    const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", prof.id);
    if (del.error) throw new Error(`Falha ao limpar papéis: ${del.error.message}`);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: prof.id, role: data.role });
    if (error) throw new Error(error.message);
    const { data: check } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", prof.id).maybeSingle();
    if (check?.role !== data.role) throw new Error("O papel não foi salvo. Tente novamente.");
    return { ok: true, email: prof.email, role: data.role };
  });

export const adminListRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])

  .handler(async ({ context }) => {
    await assertAdmin(context);
    // Precisa do client de serviço: a policy de RLS de user_roles é
    // por-usuário, então o client do próprio admin devolveria só a
    // linha dele e a aba Equipe mostrava todo mundo como "cliente".
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("user_roles").select("user_id, role");
    if (error) {
      const fb = await context.supabase.from("user_roles").select("user_id, role");
      return fb.data ?? [];
    }
    return data ?? [];
  });

// ---- Client license operations ----

export const adminRenewClientServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaExtend } = await import("./yaarsa.server");
    const { data: lic } = await supabaseAdmin.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    const target = nextDay20();
    const ymd = target.toISOString().slice(0, 10);
    const r = await yaarsaExtend(lic.yaarsa_email, ymd, (lic as any).panel ?? "v457");
    if (r.Fail) throw new Error(`Painel: ${r.Fail}`);
    await supabaseAdmin.from("licenses").update({
      expires_at: target.toISOString(),
      server_paid_until: target.toISOString(),
      suspended_at: null, suspended_by: null, expires_at_before_suspend: null,
      revoked: false,
    }).eq("id", data.licenseId);
    return { ok: true, expires_at: target.toISOString() };
  });

export const adminRecreateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaCreateAccount, yaarsaRemoveAccount, generateCredentials, encrypt } = await import("./yaarsa.server");
    const { data: lic } = await supabaseAdmin.from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    const panel = (lic as any).panel ?? "v457";

    // Best-effort remove old yaarsa account, then create a new one on the same panel
    await yaarsaRemoveAccount(lic.yaarsa_email, panel);
    const creds = generateCredentials();
    const target = nextDay20();
    const yr = await yaarsaCreateAccount({
      username: creds.username, email: creds.email, password: creds.password,
      planSlug: lic.plan_slug, totalPaid: 0, additionalInfo: `shadow-recreate-${lic.id}`,
      panel,
    });
    if (yr.Fail) throw new Error(`Painel: ${yr.Fail}`);
    const { yaarsaExtend } = await import("./yaarsa.server");
    await yaarsaExtend(creds.email, target.toISOString().slice(0, 10), panel);

    // Trial: expira em 24h reais (o cron de expiração corta no Yaarsa quando bate).
    // Demais planos: alinha ao próximo dia 20.
    const isTrial = lic.is_trial || lic.plan_slug === "trial";
    const newExpiresAt = isTrial
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : target;
    await supabaseAdmin.from("licenses").update({
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: newExpiresAt.toISOString(),
      server_paid_until: isTrial ? null : target.toISOString(),
      suspended_at: null, suspended_by: null, expires_at_before_suspend: null,
      disabled_at: null, revoked: false,
    }).eq("id", data.licenseId);

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`, action: "admin_recreate_license", outcome: "success",
      context: { license_id: data.licenseId, is_trial: isTrial, new_email: creds.email } as any,
    } as any);
    return { ok: true, credentials: creds, expires_at: newExpiresAt.toISOString(), is_trial: isTrial };
  });

// Substitui o trial quebrado de um usuário: remove a conta antiga do Yaarsa,
// apaga a linha antiga em licenses/trials e gera um trial novo (24h) numa
// conta fresca. Uso: cliente reporta "não consigo usar meu trial".
export const adminReplaceUserTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaCreateAccount, yaarsaRemoveAccount, generateCredentials, encrypt } = await import("./yaarsa.server");

    const { data: oldLic } = await supabaseAdmin
      .from("licenses").select("*")
      .eq("user_id", data.userId).eq("is_trial", true).maybeSingle();

    const panel: "v457" | "v46" = (oldLic as any)?.panel ?? "v457";

    // 1) Remove conta antiga no painel (best-effort, ignora "não encontrado").
    if (oldLic) {
      const rem = await yaarsaRemoveAccount(oldLic.yaarsa_email, panel);
      if (rem.Fail && !/not.*found|inexist|1005/i.test(rem.Fail)) {
        // não bloqueia: log e segue
        await supabaseAdmin.from("integration_logs").insert({
          source: `yaarsa-${panel}`, action: "admin_replace_trial_remove", outcome: "warn",
          error: rem.Fail, context: { user_id: data.userId, email: oldLic.yaarsa_email } as any,
        } as any);
      }
      await supabaseAdmin.from("trials").delete().eq("user_id", data.userId);
      await supabaseAdmin.from("licenses").delete().eq("id", oldLic.id);
    }

    // 2) Cria trial fresco.
    const creds = generateCredentials();
    const yr = await yaarsaCreateAccount({
      username: creds.username, email: creds.email, password: creds.password,
      planSlug: "trial", totalPaid: 0, additionalInfo: `shadow-admin-retrial-${data.userId}`,
      panel,
    });
    if (yr.Fail) throw new Error(`Painel: ${yr.Fail}`);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { data: newLic, error: insErr } = await supabaseAdmin.from("licenses").insert({
      user_id: data.userId,
      plan_slug: "trial",
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: expiresAt.toISOString(),
      is_trial: true,
      panel,
    } as any).select("*").single();
    if (insErr || !newLic) throw new Error(insErr?.message || "Falha ao gravar licença");

    await supabaseAdmin.from("trials").upsert(
      { user_id: data.userId, license_id: newLic.id } as any,
      { onConflict: "user_id" },
    );

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`, action: "admin_replace_trial", outcome: "success",
      context: { user_id: data.userId, new_email: creds.email, expires_at: expiresAt.toISOString() } as any,
    } as any);

    return { ok: true, credentials: creds, expires_at: expiresAt.toISOString(), panel };
  });



// Busca usuários por e-mail, apelido, nome ou credenciais de painel.
export const adminFindUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ query: z.string().trim().min(2).max(120) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.trim();
    const like = `%${q}%`;

    const { data: profs, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,display_name,created_at")
      .or(`email.ilike.${like},display_name.ilike.${like},full_name.ilike.${like}`)
      .limit(20);
    if (profErr) throw new Error(profErr.message);


    const found = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));

    // também aceita busca pelas credenciais do painel
    const { data: licsByCred } = await supabaseAdmin
      .from("licenses")
      .select("user_id")
      .or(`yaarsa_username.ilike.${like},yaarsa_email.ilike.${like}`)
      .limit(20);
    const extraIds = Array.from(new Set((licsByCred ?? []).map((l: any) => l.user_id))).filter((id) => !found.has(id));
    if (extraIds.length) {
      const { data: extra } = await supabaseAdmin
        .from("profiles").select("id,email,full_name,display_name,created_at").in("id", extraIds);
      for (const p of extra ?? []) found.set((p as any).id, p);
    }

    const ids = Array.from(found.keys());
    if (!ids.length) return [];
    const { data: trials } = await supabaseAdmin
      .from("licenses")
      .select("user_id,yaarsa_username,yaarsa_email,expires_at,revoked,disabled_at,created_at")
      .eq("is_trial", true)
      .in("user_id", ids);
    const trialMap = new Map((trials ?? []).map((t: any) => [t.user_id, t]));

    return ids.map((id) => ({ ...found.get(id), trial: trialMap.get(id) ?? null }));
  });

export const adminListLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      source: z.string().optional(),
      outcome: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("integration_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.source) q = q.eq("source", data.source);
    if (data.outcome) q = q.eq("outcome", data.outcome);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============ Emitir licença para cliente (novo ou antigo) ============


export const adminCreateLicenseForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => CreateLicenseInput.parse(i))
  .handler(async ({ data, context }) => {
    try {
      await assertStaff(context);
    
    // Verificação de Cota para Staff (Moderadores) - Admins ignoram
    const { isAdmin } = await (await import("@/lib/roles.server")).resolveRoles(context);
    if (!isAdmin) {
      // A RPC/ tabelas de cota podem não existir em todos os ambientes.
      // Nesse caso não podemos bloquear a emissão (era o motivo do erro
      // "limite diário" aparecendo mesmo com HOJE 0/5).
      const { data: quotaOk, error: quotaErr } = await context.supabase.rpc(
        'check_license_quota' as any,
        { _staff_id: context.userId },
      );
      if (!quotaErr && quotaOk === false) {
        throw new Error("Você atingiu seu limite diário ou mensal de geração de licenças manuais. Solicite liberação a um administrador.");
      }
      if (quotaErr) console.warn("[quota] check_license_quota indisponível:", quotaErr.message);
    }


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaCreateAccount, yaarsaExtend, generateCredentials, encrypt, resolvePanelFromPlanSlug } = await import("./yaarsa.server");

    const { userId, invited } = await resolveOrInviteUser(data.userEmail.toLowerCase());
    const { expiresAt, serverPaidUntil } = computeExpiries(data.planSlug, data.customExpireDate);
    const creds = generateCredentials();
    const targetPanel = data.panel ?? (await resolvePanelFromPlanSlug(data.planSlug));

    const yr = await yaarsaCreateAccount({
      username: creds.username,
      email: creds.email,
      password: creds.password,
      planSlug: data.planSlug,
      totalPaid: 0,
      additionalInfo: `shadow-admin-${data.isLegacy ? "legacy" : "new"}-${userId.slice(0, 8)}`,
      panel: targetPanel,
    });
    if (yr.Fail) throw new Error(`Painel[${targetPanel}]: ${yr.Fail}`);
    await yaarsaExtend(creds.email, expiresAt.toISOString().slice(0, 10), targetPanel);

    const tier: VersionTier = tierFromPlanSlug(data.planSlug);
    const serverIpForPanel = await (await import("@/lib/yaarsa.server")).resolvePanelServerHost(targetPanel);
    const { data: lic, error: licErr } = await supabaseAdmin.from("licenses").insert({
      user_id: userId,
      plan_slug: data.planSlug,
      yaarsa_username: creds.username,
      yaarsa_email: creds.email,
      yaarsa_password_enc: encrypt(creds.password),
      expires_at: expiresAt.toISOString(),
      server_paid_until: serverPaidUntil.toISOString(),
      is_trial: false,
      version_tier: tier,
      is_legacy: !!data.isLegacy,
      legacy_server_fee_brl: data.isLegacy ? (data.legacyServerFeeBrl ?? 250) : null,
      panel: targetPanel,
      server_ip: serverIpForPanel,
    } as any).select("*").single();
    if (licErr) throw new Error(licErr.message);

    // Registrar no log de cotas
    try {
      await (context.supabase.from('license_generation_logs' as any) as any).insert({
        staff_id: context.userId,
        customer_email: data.userEmail.toLowerCase(),
        plan_slug: data.planSlug,
        license_id: lic.id
      });
    } catch (logErr) {
      console.warn("[quota] falha ao registrar license_generation_logs", logErr);
    }



    if (data.postToThreadId) {
      const body =
        `// nova licença emitida pelo admin\n` +
        `plano: ${data.planSlug} (${tier})\n` +
        `painel: ${targetPanel === "v46" ? "Shadow 4.6" : targetPanel === "v455" ? "Shadow 4.5.5" : "Shadow 4.5.7"}\n` +
        `user: ${creds.username}\n` +
        `email: ${creds.email}\n` +
        `senha: ${creds.password}\n` +
        `servidor: ${lic?.server_ip ?? serverIpForPanel}\n` +
        `expira: ${expiresAt.toLocaleString("pt-BR")}` +
        (data.isLegacy ? `\ntaxa mensal servidor: R$ ${data.legacyServerFeeBrl ?? 250} (cliente antigo)` : "");
      // Insert via authenticated client so the trigger preserves is_admin=true
      await context.supabase.from("support_messages").insert({
        thread_id: data.postToThreadId,
        sender_id: context.userId,
        is_admin: true,
        body,
      });
      await supabaseAdmin.from("support_threads").update({ updated_at: new Date().toISOString() }).eq("id", data.postToThreadId);

    }

    return {
      ok: true,
      invited,
      userId,
      credentials: { username: creds.username, email: creds.email, password: creds.password, server_ip: lic?.server_ip ?? serverIpForPanel },
      expires_at: expiresAt.toISOString(),
      version_tier: tier,
      panel: targetPanel,
    };
  } catch (err: any) {
    console.error("[ADMIN_ERR] createLicense:", err);
    throw err;
  }
});

export const adminSetLicenseTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    licenseId: z.string().uuid(),
    versionTier: z.enum(["weekly", "monthly_457", "lifetime_46"]),
    isLegacy: z.boolean().optional(),
    legacyServerFeeBrl: z.number().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { version_tier: data.versionTier };
    if (data.isLegacy !== undefined) patch.is_legacy = data.isLegacy;
    if (data.legacyServerFeeBrl !== undefined) patch.legacy_server_fee_brl = data.legacyServerFeeBrl;
    const { error } = await supabaseAdmin.from("licenses").update(patch as any).eq("id", data.licenseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============ Registrar cliente antigo com login Yaarsa já existente ============
// Não chama Yaarsa create — apenas grava a licença no nosso banco com as
// credenciais que o admin fornece.

export const adminRegisterLegacyLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => RegisterLegacyInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaExtend, encrypt, resolvePanelFromPlanSlug } = await import("./yaarsa.server");

    const { userId, invited } = await resolveOrInviteUser(data.userEmail.toLowerCase());
    const tier: VersionTier = tierFromPlanSlug(data.planSlug);
    const expiresAt = new Date(data.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new Error("Data de expiração inválida");
    const targetPanel = data.panel ?? (await resolvePanelFromPlanSlug(data.planSlug));

    // Best-effort: align Yaarsa expire_date with our record on the correct panel.
    try { await yaarsaExtend(data.yaarsaEmail, expiresAt.toISOString().slice(0, 10), targetPanel); } catch { /* ignore */ }

    const nextDay20 = (() => {
      const d = new Date();
      const t = new Date(d.getFullYear(), d.getMonth(), 20, 23, 59, 59);
      if (d.getDate() >= 20) t.setMonth(t.getMonth() + 1);
      return t;
    })();

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      plan_slug: data.planSlug,
      yaarsa_username: data.yaarsaUsername,
      yaarsa_email: data.yaarsaEmail,
      yaarsa_password_enc: encrypt(data.yaarsaPassword),
      expires_at: expiresAt.toISOString(),
      server_paid_until: nextDay20.toISOString(),
      is_trial: false,
      version_tier: tier,
      is_legacy: true,
      legacy_server_fee_brl: data.legacyServerFeeBrl ?? 250,
      panel: targetPanel,
    };
    insertPayload.server_ip =
      data.serverIp ?? (await (await import("@/lib/yaarsa.server")).resolvePanelServerHost(targetPanel));

    const { data: lic, error } = await supabaseAdmin.from("licenses").insert(insertPayload as any).select("*").single();
    if (error) throw new Error(error.message);
    return { ok: true, invited, userId, licenseId: lic.id, version_tier: tier };
  });

// ============ Licenças perto de vencer (para o admin ver) ============
export const adminListExpiring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ days: z.number().int().min(1).max(60).optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const days = data.days ?? 5;
    const cutoff = new Date(Date.now() + days * 86400000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("licenses")
      .select("id, user_id, plan_slug, version_tier, is_legacy, expires_at, server_paid_until, server_overdue_at, revoked, disabled_at, yaarsa_username")
      .is("disabled_at", null)
      .order("expires_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const now = Date.now();
    const filtered = (rows ?? []).filter((r: any) =>
      !r.disabled_at && !r.revoked &&
      ((r.expires_at && new Date(r.expires_at).getTime() - now < days * 86400000) ||
       (r.server_paid_until && new Date(r.server_paid_until).getTime() - now < days * 86400000))
    );
    return filtered;
  });


// ============ Referrals admin ============
export const adminListReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("referrals").select("*").order("created_at", { ascending: false }).limit(500);
    const list = (rows ?? []) as any[];
    const ids = Array.from(new Set(list.flatMap((r) => [r.referrer_id, r.referred_id])));
    let emailMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,email,pix_key").in("id", ids);
      emailMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
      // attach pix_key snapshot fallback
      const pixMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.pix_key]));
      for (const r of list) {
        if (!r.pix_key && r.reward_type === "pix") r.pix_key = pixMap[r.referrer_id] ?? null;
      }
    }
    return list.map((r) => ({
      ...r,
      referrer_email: emailMap[r.referrer_id] ?? null,
      referred_email: emailMap[r.referred_id] ?? null,
    }));
  });

export const adminMarkReferralPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      referralId: z.string().uuid(),
      status: z.enum(["pending", "granted", "paid"]),
      notes: z.string().trim().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { reward_status: data.status };
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    if (data.notes) patch.notes = data.notes;
    const { error } = await supabaseAdmin.from("referrals").update(patch).eq("id", data.referralId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============ Alertas de falhas recorrentes ============
export const adminGetAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabaseAdmin
      .from("integration_logs")
      .select("source,action,outcome,http_status,error,created_at,url")
      .gte("created_at", since)
      .neq("outcome", "success")
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = logs ?? [];
    const groups = new Map<string, { source: string; action: string | null; count: number; lastError: string | null; lastAt: string; httpStatuses: number[] }>();
    for (const r of rows) {
      const key = `${r.source}::${r.action ?? "-"}`;
      const g = groups.get(key) ?? { source: r.source, action: r.action, count: 0, lastError: null, lastAt: r.created_at, httpStatuses: [] };
      g.count += 1;
      if (!g.lastError && r.error) g.lastError = String(r.error).slice(0, 240);
      if (r.http_status) g.httpStatuses.push(r.http_status);
      groups.set(key, g);
    }

    const alerts = Array.from(groups.values())
      .filter((g) => g.source === "yaarsa" || g.count >= 3)
      .map((g) => ({
        ...g,
        severity: (g.source === "yaarsa" && g.count >= 5) || g.count >= 10 ? "critical" : g.count >= 3 ? "warn" : "info",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Also flag licenças com problemas óbvios
    const { data: stuck } = await supabaseAdmin
      .from("licenses")
      .select("id,server_paid_until,server_overdue_at,revoked")
      .not("server_overdue_at", "is", null)
      .eq("revoked", false)
      .limit(20);

    return {
      generated_at: new Date().toISOString(),
      failure_groups: alerts,
      stuck_licenses: (stuck ?? []).length,
      total_failures_1h: rows.length,
    };
  });

// ============ Lookup de email nos painéis Yaarsa (todos) ============
export const adminLookupYaarsaEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ email: z.string().trim().email().max(255) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { yaarsaLookupEmailAllPanels } = await import("./yaarsa.server");
    return await yaarsaLookupEmailAllPanels(data.email.toLowerCase());
  });


// ============ "Pagou o servidor por fora" — clientes externos ============
// Fluxo: admin marca uma licença como "pago fora", o sistema estende no
// Yaarsa até o próximo dia 20 e salva `paid_externally_until`. O cron
// `verify-external-payers` reforça essa data a cada 3 dias para garantir
// que o painel não caia. Para "cancelar", basta desmarcar — na próxima
// virada do dia 20 o cron normal revoga.


export const adminMarkPaidExternally = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      licenseId: z.string().uuid(),
      untilDate: z.string().optional(), // YYYY-MM-DD; default = próximo dia 20
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { yaarsaExtend } = await import("./yaarsa.server");

    const { data: lic } = await supabaseAdmin
      .from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");

    const target = data.untilDate ? new Date(`${data.untilDate}T23:59:59`) : nextDay20Date();
    if (Number.isNaN(target.getTime())) throw new Error("Data inválida");
    const ymd = target.toISOString().slice(0, 10);
    const panel = (lic.panel === "v46" ? "v46" : "v457") as "v457" | "v46";

    const r = await yaarsaExtend(lic.yaarsa_email, ymd, panel);
    if (r.Fail) throw new Error(`Painel[${panel}]: ${r.Fail}`);

    const { error: upErr } = await supabaseAdmin.from("licenses").update({
      paid_externally: true,
      paid_externally_until: ymd,
      paid_externally_marked_at: new Date().toISOString(),
      paid_externally_last_check_at: new Date().toISOString(),
      paid_externally_last_check_status: "aligned",
      expires_at: target.toISOString(),
      server_paid_until: target.toISOString(),
      revoked: false,
      server_overdue_at: null,
      suspended_at: null, suspended_by: null, expires_at_before_suspend: null,
    } as any).eq("id", data.licenseId);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("integration_logs").insert({
      source: "external-payer", action: "mark_paid", outcome: "success",
      context: { license_id: lic.id, user_id: lic.user_id, until: ymd, panel } as any,
    });

    return { ok: true, until: ymd, panel };
  });

export const adminUnmarkPaidExternally = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("licenses").update({
      paid_externally: false,
      paid_externally_until: null,
      paid_externally_marked_at: null,
      paid_externally_last_check_at: null,
      paid_externally_last_check_status: null,
    } as any).eq("id", data.licenseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Lista clientes que pagam por fora — com status da última verificação da IA
// e quantos dias faltam até o próximo dia 20.
export const adminListExternalPayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("licenses")
      .select("id, user_id, plan_slug, version_tier, panel, yaarsa_username, yaarsa_email, server_ip, expires_at, server_paid_until, paid_externally, paid_externally_until, paid_externally_marked_at, paid_externally_last_check_at, paid_externally_last_check_status, is_legacy, revoked, disabled_at")
      .eq("paid_externally", true)
      .order("paid_externally_until", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const ids = Array.from(new Set(list.map((r: any) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,email,full_name,display_name").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return list.map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

// Lista candidatos para marcar como "pagador externo": licenças legacy
// ativas que ainda NÃO estão marcadas como externas.
export const adminListLegacyCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("licenses")
      .select("id, user_id, plan_slug, version_tier, panel, yaarsa_username, yaarsa_email, server_ip, expires_at, server_paid_until, is_legacy, revoked, disabled_at")
      .eq("is_legacy", true)
      .eq("paid_externally", false)
      .is("disabled_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const ids = Array.from(new Set(list.map((r: any) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,email,full_name,display_name").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return list.map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

// ---- Business metrics (receita, reembolsos, tempo de resposta) ----
export const adminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const prevSince = new Date(Date.now() - 60 * 86400000).toISOString();

    const [{ data: orders30 }, { data: refunds30 }, { data: msgs }] = await Promise.all([
      supabaseAdmin.from("orders").select("amount,status,created_at").gte("created_at", prevSince),
      (supabaseAdmin.from("refund_requests") as any).select("id,status,amount,created_at").gte("created_at", since),
      supabaseAdmin.from("support_messages").select("thread_id,is_admin,is_system,created_at").gte("created_at", since).order("created_at", { ascending: true }),
    ]);

    const all = (orders30 ?? []) as any[];
    const paid = all.filter((o) => o.status === "paid");
    const cur = paid.filter((o) => o.created_at >= since);
    const prev = paid.filter((o) => o.created_at < since);
    const revenue30 = cur.reduce((s, o) => s + Number(o.amount || 0), 0);
    const revenuePrev30 = prev.reduce((s, o) => s + Number(o.amount || 0), 0);
    const growth = revenuePrev30 > 0 ? ((revenue30 - revenuePrev30) / revenuePrev30) * 100 : null;
    const attempts30 = all.filter((o) => o.created_at >= since);
    const conversion = attempts30.length ? (cur.length / attempts30.length) * 100 : null;
    const ticket = cur.length ? revenue30 / cur.length : 0;

    const refunds = (refunds30 ?? []) as any[];
    const refunded = refunds.filter((r) => ["approved", "refunded"].includes(String(r.status)));
    const refundRate = cur.length ? (refunded.length / cur.length) * 100 : 0;
    const refundAmount = refunded.reduce((s, r) => s + Number(r.amount || 0), 0);
    const refundsPending = refunds.filter((r) => String(r.status) === "requested").length;

    // Average first-response time (customer message -> next staff reply)
    const byThread = new Map<string, any[]>();
    for (const m of (msgs ?? []) as any[]) {
      if (m.is_system) continue;
      const arr = byThread.get(m.thread_id) ?? [];
      arr.push(m);
      byThread.set(m.thread_id, arr);
    }
    const deltas: number[] = [];
    for (const arr of byThread.values()) {
      let openedAt: number | null = null;
      for (const m of arr) {
        const t = new Date(m.created_at).getTime();
        if (!m.is_admin) { if (openedAt === null) openedAt = t; }
        else if (openedAt !== null) { deltas.push(t - openedAt); openedAt = null; }
      }
    }
    const avgResponseMin = deltas.length ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length / 60000) : null;

    return {
      revenue30, revenuePrev30, growth, conversion, ticket,
      paidCount: cur.length, attempts: attempts30.length,
      refundRate, refundAmount, refundsPending, refundCount: refunded.length,
      avgResponseMin, threadsAnswered: deltas.length,
    };
  });

// ============ Monitoramento de erros / regressões ============
export const adminHealthMonitor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ hours: z.number().int().min(1).max(72).optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const hours = data.hours ?? 24;
    const now = Date.now();
    const windowMs = hours * 3600_000;
    const sinceIso = new Date(now - windowMs).toISOString();
    const prevIso = new Date(now - windowMs * 2).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("integration_logs")
      .select("source,action,outcome,http_status,latency_ms,error,created_at,endpoint_kind")
      .gte("created_at", prevIso)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const all = rows ?? [];
    const inCur = (t: string) => new Date(t).getTime() >= now - windowMs;
    const cur = all.filter((r) => inCur(r.created_at));
    const prev = all.filter((r) => !inCur(r.created_at));
    const isFail = (r: any) => r.outcome !== "success";

    const curFail = cur.filter(isFail);
    const prevFail = prev.filter(isFail);
    const errorRate = cur.length ? curFail.length / cur.length : 0;
    const prevErrorRate = prev.length ? prevFail.length / prev.length : 0;

    // Latência p95 (somente eventos com latência medida)
    const lats = cur.map((r) => r.latency_ms).filter((n): n is number => typeof n === "number" && n > 0).sort((a, b) => a - b);
    const p95 = lats.length ? lats[Math.min(lats.length - 1, Math.floor(lats.length * 0.95))] : null;
    const prevLats = prev.map((r) => r.latency_ms).filter((n): n is number => typeof n === "number" && n > 0).sort((a, b) => a - b);
    const prevP95 = prevLats.length ? prevLats[Math.min(prevLats.length - 1, Math.floor(prevLats.length * 0.95))] : null;

    // Séries por hora (para o mini-gráfico)
    const buckets = Array.from({ length: hours }, (_, i) => {
      const start = now - (hours - i) * 3600_000;
      const end = start + 3600_000;
      const slice = cur.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t >= start && t < end;
      });
      return { hour: new Date(start).toISOString(), total: slice.length, failures: slice.filter(isFail).length };
    });

    // Agrupamento de falhas por assinatura (source + action + outcome)
    const groups = new Map<string, any>();
    for (const r of curFail) {
      const key = `${r.source}::${r.action ?? "-"}::${r.outcome ?? "-"}`;
      const g = groups.get(key) ?? {
        key, source: r.source, action: r.action, outcome: r.outcome,
        count: 0, prevCount: 0, firstAt: r.created_at, lastAt: r.created_at,
        lastError: null as string | null, statuses: new Set<number>(),
      };
      g.count += 1;
      if (new Date(r.created_at) > new Date(g.lastAt)) g.lastAt = r.created_at;
      if (new Date(r.created_at) < new Date(g.firstAt)) g.firstAt = r.created_at;
      if (!g.lastError && r.error) g.lastError = String(r.error).slice(0, 300);
      if (r.http_status) g.statuses.add(r.http_status);
      groups.set(key, g);
    }
    for (const r of prevFail) {
      const key = `${r.source}::${r.action ?? "-"}::${r.outcome ?? "-"}`;
      const g = groups.get(key);
      if (g) g.prevCount += 1;
    }

    const issues = Array.from(groups.values())
      .map((g) => {
        const delta = g.prevCount === 0 ? (g.count >= 3 ? 100 : 0) : Math.round(((g.count - g.prevCount) / g.prevCount) * 100);
        const isNew = g.prevCount === 0 && g.count > 0;
        const isRegression = isNew ? g.count >= 3 : delta >= 50 && g.count >= 3;
        const severity = g.count >= 10 || (isRegression && g.count >= 5) ? "critical" : g.count >= 3 ? "warn" : "info";
        return {
          key: g.key, source: g.source, action: g.action, outcome: g.outcome,
          count: g.count, prevCount: g.prevCount, delta, isNew, isRegression, severity,
          firstAt: g.firstAt, lastAt: g.lastAt, lastError: g.lastError,
          statuses: Array.from(g.statuses as Set<number>).sort((a, b) => a - b),
        };
      })
      .sort((a, b) => (b.isRegression ? 1 : 0) - (a.isRegression ? 1 : 0) || b.count - a.count)
      .slice(0, 25);

    // Sinais de negócio que indicam falha silenciosa
    const [{ count: stuckOrders }, { count: overdueRefunds }, { count: failedJobs }] = await Promise.all([
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "processing").lt("created_at", new Date(now - 30 * 60_000).toISOString()),
      supabaseAdmin.from("refund_requests").select("id", { count: "exact", head: true })
        .eq("status", "pending").lt("deadline_at", new Date().toISOString()),
      supabaseAdmin.from("apk_jobs").select("id", { count: "exact", head: true })
        .eq("status", "failed").gte("created_at", sinceIso),
    ] as any);

    const regressions = issues.filter((i) => i.isRegression).length;
    const status = issues.some((i) => i.severity === "critical") || (stuckOrders ?? 0) > 0
      ? "critical"
      : issues.some((i) => i.severity === "warn") || regressions > 0 || (overdueRefunds ?? 0) > 0
        ? "degraded"
        : "healthy";

    return {
      generated_at: new Date().toISOString(),
      hours,
      status,
      totals: { events: cur.length, failures: curFail.length, prevFailures: prevFail.length },
      errorRate, prevErrorRate,
      p95, prevP95,
      buckets,
      issues,
      regressions,
      signals: {
        stuckOrders: stuckOrders ?? 0,
        overdueRefunds: overdueRefunds ?? 0,
        failedApkJobs: failedJobs ?? 0,
      },
    };
  });

// ---------------------------------------------------------------------------
// Busca global do admin (Ctrl+K) — clientes, pedidos, licenças e tickets
// ---------------------------------------------------------------------------
export const adminGlobalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ q: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const q = data.q.trim();
    if (q.length < 2) return { users: [], orders: [], licenses: [], threads: [] };
    const like = `%${q}%`;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, orders, licenses, threads] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,email,full_name,display_name,created_at")
        .or(`email.ilike.${like},full_name.ilike.${like},display_name.ilike.${like}`)
        .limit(8),
      supabaseAdmin
        .from("orders")
        .select("id,user_id,plan_slug,amount,status,created_at")
        .or(isUuid ? `id.eq.${q},mp_payment_id.eq.${q}` : `mp_payment_id.ilike.${like},plan_slug.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("licenses")
        .select("id,user_id,plan_slug,yaarsa_email,yaarsa_username,expires_at,revoked,panel")
        .or(`yaarsa_email.ilike.${like},yaarsa_username.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("support_threads")
        .select("id,user_id,subject,status,category,updated_at")
        .ilike("subject", like)
        .order("updated_at", { ascending: false })
        .limit(8),
    ]);

    return {
      users: users.data ?? [],
      orders: orders.data ?? [],
      licenses: licenses.data ?? [],
      threads: threads.data ?? [],
    };
  });

// Ficha 360º de um cliente: tudo que existe sobre ele em um lugar só.
export const adminCustomer360 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const uid = data.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profile, roles, licenses, orders, threads, refunds, apkJobs, cashback, referrals] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
      supabaseAdmin.from("licenses").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("orders").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("support_threads").select("id,subject,status,category,priority,updated_at,unread_by_staff").eq("user_id", uid).order("updated_at", { ascending: false }).limit(15),
      supabaseAdmin.from("refund_requests").select("id,amount,status,reason,created_at,deadline_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(15),
      supabaseAdmin.from("apk_jobs").select("id,status,source_filename,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("cashback_ledger").select("amount").eq("user_id", uid),
      supabaseAdmin.from("referrals").select("id,reward_amount,reward_status,created_at").eq("referrer_id", uid).limit(20),
    ]);

    const paidOrders = (orders.data ?? []).filter((o: any) => o.status === "paid");
    const totalSpent = paidOrders.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
    const cashbackBalance = (cashback.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const activeLicenses = (licenses.data ?? []).filter(
      (l: any) => !l.revoked && !l.disabled_at && (!l.expires_at || new Date(l.expires_at) > new Date()),
    );

    return {
      profile: profile.data ?? null,
      roles: (roles.data ?? []).map((r: any) => r.role),
      licenses: licenses.data ?? [],
      orders: orders.data ?? [],
      threads: threads.data ?? [],
      refunds: refunds.data ?? [],
      apkJobs: apkJobs.data ?? [],
      referrals: referrals.data ?? [],
      summary: {
        totalSpent,
        paidOrdersCount: paidOrders.length,
        ordersCount: (orders.data ?? []).length,
        cashbackBalance,
        activeLicensesCount: activeLicenses.length,
        openThreads: (threads.data ?? []).filter((t: any) => t.status !== "closed").length,
        pendingRefunds: (refunds.data ?? []).filter((r: any) => r.status === "pending").length,
        firstSeen: profile.data?.created_at ?? null,
      },
    };
  });

// Announcements are handled via src/lib/announcements.functions.ts




export const forceReloadSchema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      // Otimização: A verificação de staff agora usa resolveRoles para evitar recursividade
      const { resolveRoles } = await import("./roles.server");
      const { isStaff } = await resolveRoles({ supabase: context.supabase, userId: context.userId });
      if (!isStaff) {
        console.warn(`[admin] Unauthorized schema sync attempt by user ${context.userId}`);
        throw new Error("Acesso negado");
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      
      console.log(`[admin] AGGRESSIVE schema sync requested by Staff ${context.userId}`);
      const startTime = Date.now();
      
      // 1. Force PostgREST reload using the new SECURITY DEFINER function
      const { data, error } = await supabaseAdmin.rpc("force_refresh_schema_permissions");
      
      if (error) {
        console.error("[admin] force_refresh_schema_permissions FAILED:", error);
        
        // Fallback: Notify manually and touch tables
        if (typeof (supabaseAdmin as any).rpc === 'function') {
          const { error: notifyErr } = await (supabaseAdmin as any).rpc("notify_pgrst_reload");
          if (notifyErr) console.error("[admin] notify_pgrst_reload FAILED:", notifyErr);
        }
        
        const tables = ["tutorials", "tutorial_progress", "profiles", "licenses", "orders", "support_threads", "user_roles"];
        await Promise.allSettled(
          tables.map(table => (supabaseAdmin as any).from(table).select("count", { count: "exact", head: true }))
        );
        
        throw new Error(`Falha na sincronização primária: ${error.message}. Tabelas foram "tocadas" manualmente.`);
      }

      console.log(`[admin] Aggressive schema sync SUCCESSFUL in ${Date.now() - startTime}ms`, data);
      
      // Trigger background validation for diagnostics
      const { validateAndFixSchema } = await import("./schema-validator.server");
      validateAndFixSchema().catch(e => console.error("[admin] Background validation error:", e));
      
      return { 
        ok: true, 
        duration: Date.now() - startTime,
        rpcResult: data 
      };
    } catch (err: any) {
      console.error("[admin] forceReloadSchema CRITICAL FAILURE:", err);
      throw err;
    }
  });

export const adminUpdateReferralStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      referralId: z.string().uuid(),
      status: z.enum(["pending", "granted", "paid", "rejected"]),
      notes: z.string().trim().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("referrals")
      .update({
        reward_status: data.status,
        notes: data.notes || null,
        paid_at: data.status === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", data.referralId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/**
 * Reconciliação em massa com o painel Yaarsa (equipe).
 * Percorre as licenças (por padrão só as que aparecem inativas no site), lê a
 * data real no painel e reativa as que já estão liberadas por lá.
 */
export const adminSyncLicensesFromPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      onlyInactive: z.boolean().optional().default(true),
      licenseId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional().default(60),
    }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncLicensesWithPanel } = await import("./panel-sync.server");

    let query = supabaseAdmin
      .from("licenses").select("*")
      .is("disabled_at", null).is("suspended_at", null).eq("is_trial", false)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 60);
    if (data.licenseId) query = query.eq("id", data.licenseId);

    const { data: rows } = await query;
    const now = Date.now();
    const candidates = (rows ?? []).filter((l: any) => {
      if (data.licenseId) return true;
      if (!data.onlyInactive) return true;
      const expired = l.expires_at ? new Date(l.expires_at).getTime() <= now : false;
      return !!l.revoked || !!l.server_overdue_at || expired;
    });

    const report = await syncLicensesWithPanel(candidates as any[], { actor: "admin", userId: context.userId });
    return { ok: true, ...report };
  });

/**
 * Admin trocou a senha do cliente direto no painel Yaarsa? Esta função grava a
 * senha nova aqui para que o cliente veja em "Licenças" exatamente a senha que
 * funciona no BMob. Com `applyToPanel`, também empurra a senha para o painel.
 */
export const adminSetLicensePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      licenseId: z.string().uuid(),
      newPassword: z
        .string()
        .trim()
        .min(4, "A senha precisa ter pelo menos 4 caracteres.")
        .max(64, "A senha pode ter no máximo 64 caracteres."),
      applyToPanel: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lic } = await supabaseAdmin
      .from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");

    const panel = (lic as any).panel ?? "v457";
    const { encrypt, yaarsaSetPassword } = await import("./yaarsa.server");
    const { sha256Hex } = await import("./password-safety.server");
    const { recordLicenseAudit } = await import("./audit-trail.server");

    let panelApplied: boolean | null = null;
    if (data.applyToPanel) {
      const pr = await yaarsaSetPassword(
        (lic as any).yaarsa_email,
        data.newPassword,
        panel,
        (lic as any).yaarsa_username,
        (lic as any).expires_at ?? null,
      );
      if (pr.Fail) {
        await supabaseAdmin.from("licenses").update({
          password_synced_at: new Date().toISOString(),
          password_sync_status: "error",
          password_sync_error: String(pr.Fail).slice(0, 300),
          password_sync_by: context.userId,
        } as any).eq("id", (lic as any).id);
        throw new Error(`O painel não aceitou a troca: ${pr.Fail}`);
      }

      panelApplied = true;
    }

    const { error: upErr } = await supabaseAdmin.from("licenses").update({
      yaarsa_password_enc: encrypt(data.newPassword),
      password_fingerprint: sha256Hex(data.newPassword),
      // A senha de pausa deixa de valer quando a senha real muda.
      suspend_password_fingerprint: null,
      password_synced_at: new Date().toISOString(),
      password_sync_status: data.applyToPanel ? "applied" : "manual",
      password_sync_error: null,
      password_sync_by: context.userId,

    } as any).eq("id", (lic as any).id);
    if (upErr) throw new Error("Não foi possível salvar a senha aqui.");

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`,
      action: "admin_password_sync",
      outcome: "success",
      context: {
        license_id: (lic as any).id,
        user_id: (lic as any).user_id,
        actor_id: context.userId,
        applied_to_panel: panelApplied,
      } as any,
    } as any);

    await recordLicenseAudit({
      licenseId: (lic as any).id,
      userId: (lic as any).user_id,
      actorId: context.userId,
      actorKind: "staff",
      eventType: "password_change",
      reason: data.applyToPanel
        ? "Admin definiu uma nova senha e aplicou no painel"
        : "Admin sincronizou a senha que já havia trocado no painel",
      yaarsaEmail: (lic as any).yaarsa_email,
      panel,
      expiresBefore: (lic as any).expires_at ?? null,
      expiresAfter: (lic as any).expires_at ?? null,
      details: { applied_to_panel: panelApplied },
    });

    return { ok: true, appliedToPanel: panelApplied };
  });

/**
 * Confere a senha do login direto no painel Yaarsa (sem alterar nada) e grava
 * o resultado da última sincronização na licença. Com `adopt`, quando o painel
 * devolve uma senha diferente da nossa, adotamos a do painel — é a que o
 * cliente precisa ver em "Licenças".
 */
export const adminSyncLicensePasswordFromPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ licenseId: z.string().uuid(), adopt: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lic } = await supabaseAdmin
      .from("licenses").select("*").eq("id", data.licenseId).maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");

    const panel = (lic as any).panel ?? "v457";
    const { yaarsaReadAccount, decrypt, encrypt } = await import("./yaarsa.server");
    const { sha256Hex } = await import("./password-safety.server");

    const stamp = async (patch: Record<string, unknown>) => {
      await supabaseAdmin.from("licenses").update({
        password_synced_at: new Date().toISOString(),
        password_sync_by: context.userId,
        ...patch,
      } as any).eq("id", (lic as any).id);
    };

    let acc: { known: boolean; expireDate: string | null; password: string | null };
    try {
      acc = await yaarsaReadAccount((lic as any).yaarsa_email, panel);
    } catch (e: any) {
      await stamp({ password_sync_status: "error", password_sync_error: String(e?.message ?? e).slice(0, 300) });
      throw new Error("Não foi possível falar com o painel agora. Tente de novo em alguns minutos.");
    }

    if (!acc.known || !acc.password) {
      await stamp({
        password_sync_status: "unknown",
        password_sync_error: "O painel não devolveu a senha desta conta.",
      });
      return {
        ok: false as const,
        status: "unknown" as const,
        message: "O painel não informa a senha desta conta. Digite a senha nova manualmente abaixo.",
        panelExpireDate: acc.expireDate ?? null,
      };
    }

    let local: string | null = null;
    try {
      local = decrypt((lic as any).yaarsa_password_enc);
    } catch {
      local = null;
    }

    if (local === acc.password) {
      await stamp({ password_sync_status: "ok", password_sync_error: null });
      return {
        ok: true as const,
        status: "ok" as const,
        message: "A senha aqui já é a mesma do painel.",
        panelExpireDate: acc.expireDate ?? null,
      };
    }

    if (!data.adopt) {
      await stamp({
        password_sync_status: "divergent",
        password_sync_error: "A senha do painel está diferente da senha mostrada ao cliente.",
      });
      return {
        ok: false as const,
        status: "divergent" as const,
        message: "A senha do painel está diferente. Use \"Adotar a senha do painel\" para corrigir.",
        panelPassword: acc.password,
        panelExpireDate: acc.expireDate ?? null,
      };
    }

    await supabaseAdmin.from("licenses").update({
      yaarsa_password_enc: encrypt(acc.password),
      password_fingerprint: sha256Hex(acc.password),
      suspend_password_fingerprint: null,
      password_synced_at: new Date().toISOString(),
      password_sync_status: "ok",
      password_sync_error: null,
      password_sync_by: context.userId,
    } as any).eq("id", (lic as any).id);

    await supabaseAdmin.from("integration_logs").insert({
      source: `yaarsa-${panel}`,
      action: "admin_password_pull",
      outcome: "success",
      context: { license_id: (lic as any).id, actor_id: context.userId } as any,
    } as any);

    const { recordLicenseAudit } = await import("./audit-trail.server");
    await recordLicenseAudit({
      licenseId: (lic as any).id,
      userId: (lic as any).user_id,
      actorId: context.userId,
      actorKind: "staff",
      eventType: "password_change",
      reason: "Senha adotada do painel Yaarsa (sincronização)",
      yaarsaEmail: (lic as any).yaarsa_email,
      panel,
      expiresBefore: (lic as any).expires_at ?? null,
      expiresAfter: (lic as any).expires_at ?? null,
      details: { source: "panel_pull" },
    });

    return {
      ok: true as const,
      status: "adopted" as const,
      message: "Senha do painel adotada — o cliente já vê a senha certa.",
      panelPassword: acc.password,
      panelExpireDate: acc.expireDate ?? null,
    };
  });
