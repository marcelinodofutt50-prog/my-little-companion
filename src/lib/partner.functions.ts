import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Situação de parceria do cliente logado: acessos liberados + chamados abertos. */
// POST evita que respostas personalizadas por usuário sejam reaproveitadas
// por caches HTTP/CDN entre trocas de sessão.
export const getMyPartnerArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isEntitlementActive } = await import("@/lib/partner.server");
    const [{ data: ents }, { data: reqs }] = await Promise.all([
      context.supabase
        .from("partner_entitlements" as any)
        .select("id, plan_slug, kind, status, starts_at, expires_at, server_host, server_notes")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("partner_service_requests" as any)
        .select(
          "id, kind, status, server_ip, ssh_user, form_submitted_at, contact, notes, staff_notes, created_at, updated_at",
        )

        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const entitlements = ((ents ?? []) as any[]).map((e) => ({ ...e, active: isEntitlementActive(e) }));

    const { resolveRoles } = await import("@/lib/roles.server");
    const { isAdmin } = await resolveRoles({
      supabase: context.supabase,
      userId: context.userId,
    });

    return {
      entitlements,
      requests: (reqs ?? []) as any[],
      isAdmin,
      hasReseller: isAdmin || entitlements.some((e) => e.kind === "reseller" && e.active),
      hasManaged: isAdmin || entitlements.some((e) => e.kind === "managed" && e.active),
      hasDeploy: isAdmin || entitlements.some((e) => e.kind === "deploy"),
    };
  });

/** Cliente envia (ou atualiza) os dados do servidor pra equipe trabalhar. */
export const submitPartnerServerInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        kind: z.enum(["reseller", "deploy", "managed"]),
        serverIp: z.string().trim().max(120).optional().nullable(),
        sshUser: z.string().trim().max(60).optional().nullable(),
        sshPassword: z.string().trim().max(200).optional().nullable(),
        contact: z.string().trim().max(160).optional().nullable(),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isEntitlementActive } = await import("@/lib/partner.server");

    const { data: ents } = await supabaseAdmin
      .from("partner_entitlements")
      .select("id, kind, status, expires_at")
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .order("created_at", { ascending: false });

    const ent = (ents ?? []).find((e: any) => isEntitlementActive(e));
    if (!ent) return { error: "Você ainda não tem esse serviço ativo. Finalize a compra na página de planos." };

    // O serviço de instalação precisa do acesso à VPS. A senha é guardada
    // criptografada e só a equipe autorizada consegue revelar.
    const { data: open } = await supabaseAdmin
      .from("partner_service_requests")
      .select("id")
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { encrypt } = await import("@/lib/yaarsa.server");
    const payload: Record<string, unknown> = {
      server_ip: data.serverIp || null,
      ssh_user: data.sshUser || null,
      form_submitted_at: new Date().toISOString(),
      contact: data.contact || null,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
    };
    // Só sobrescreve a senha quando o cliente digitou uma nova.
    if (data.sshPassword) payload["ssh_password_enc"] = encrypt(data.sshPassword);


    if (open?.id) {
      const { error } = await supabaseAdmin.from("partner_service_requests").update(payload as any).eq("id", open.id);
      if (error) return { error: error.message };
      return { ok: true, requestId: open.id };
    }

    const { data: created, error } = await supabaseAdmin
      .from("partner_service_requests")
      .insert({ user_id: context.userId, entitlement_id: (ent as any).id, kind: data.kind, status: "open", ...payload } as any)
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { ok: true, requestId: created.id };
  });

/** Painel do admin: todos os parceiros e chamados. */
export const adminListPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdminRole } = await import("@/lib/roles.server");
    await assertAdminRole(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: ents }, { data: reqs }] = await Promise.all([
      supabaseAdmin.from("partner_entitlements").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("partner_service_requests").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    const ids = Array.from(new Set([...(ents ?? []), ...(reqs ?? [])].map((r: any) => r.user_id)));
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, email, display_name").in("id", ids)
      : { data: [] as any[] };
    // Nunca devolvemos a senha guardada aqui: só a marca de que existe.
    const safeReqs = ((reqs ?? []) as any[]).map(({ ssh_password_enc, ...r }) => ({
      ...r,
      ssh_password_enc: ssh_password_enc ? true : null,
    }));
    return { entitlements: ents ?? [], requests: safeReqs, profiles: profiles ?? [] };

  });

/** Painel do admin: atualiza andamento do chamado / dados do servidor entregue. */
export const adminUpdatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid().optional(),
        entitlementId: z.string().uuid().optional(),
        status: z.enum(["open", "in_progress", "done", "cancelled", "active", "pending_setup", "expired"]).optional(),
        staffNotes: z.string().max(4000).optional().nullable(),
        serverHost: z.string().max(200).optional().nullable(),
        serverNotes: z.string().max(4000).optional().nullable(),
        extendDays: z.number().int().min(1).max(365).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import("@/lib/roles.server");
    await assertAdminRole(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.requestId) {
      const patch: any = { updated_at: new Date().toISOString() };
      if (data.status && ["open", "in_progress", "done", "cancelled"].includes(data.status)) patch.status = data.status;
      if (data.staffNotes !== undefined) patch.staff_notes = data.staffNotes;
      const { error } = await supabaseAdmin.from("partner_service_requests").update(patch).eq("id", data.requestId);
      if (error) return { error: error.message };
    }

    if (data.entitlementId) {
      const patch: any = { updated_at: new Date().toISOString() };
      if (data.status && ["active", "pending_setup", "expired", "cancelled"].includes(data.status)) patch.status = data.status;
      if (data.serverHost !== undefined) patch.server_host = data.serverHost;
      if (data.serverNotes !== undefined) patch.server_notes = data.serverNotes;
      if (data.extendDays) {
        const { data: cur } = await supabaseAdmin
          .from("partner_entitlements").select("expires_at").eq("id", data.entitlementId).maybeSingle();
        const base = cur?.expires_at && new Date(cur.expires_at).getTime() > Date.now() ? new Date(cur.expires_at) : new Date();
        base.setDate(base.getDate() + data.extendDays);
        patch.expires_at = base.toISOString();
        patch.status = "active";
      }
      const { error } = await supabaseAdmin.from("partner_entitlements").update(patch).eq("id", data.entitlementId);
      if (error) return { error: error.message };
    }

    return { ok: true };
  });

/** Admin/equipe: revela a senha da VPS enviada pelo cliente (fica no log de auditoria). */
export const adminRevealPartnerServerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveRoles } = await import("@/lib/roles.server");
    const { isAdmin } = await resolveRoles(context);
    if (!isAdmin) return { error: "Apenas o administrador pode ver essa senha." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin
      .from("partner_service_requests")
      .select("id, user_id, ssh_password_enc")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req || !(req as any).ssh_password_enc) return { error: "Esse chamado não tem senha guardada." };

    const { decrypt } = await import("@/lib/yaarsa.server");
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      event: "partner_server_password_reveal",
      metadata: { request_id: (req as any).id, owner: (req as any).user_id },
    });
    return { ok: true, password: decrypt((req as any).ssh_password_enc) };
  });
