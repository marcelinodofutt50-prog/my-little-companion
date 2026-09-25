import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===========================================================================
// SISTEMA DE STAFF & HIERARQUIA
// ===========================================================================

async function profilesMap(db: any, ids: string[]) {
  const map = new Map<string, { email: string | null; display_name: string | null; full_name: string | null }>();
  if (!ids.length) return map;
  const { data } = await db.from("profiles").select("id, email, display_name, full_name").in("id", ids);
  for (const p of (data ?? []) as any[]) map.set(p.id, { email: p.email, display_name: p.display_name, full_name: p.full_name });
  return map;
}

export const staffListApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { pickAdminClient } = await import("@/lib/admin-read.server");
    const { db } = await pickAdminClient(context.supabase);
    const { data, error } = await db
      .from("staff_applications")
      .select("id, user_id, full_name, discord_tag, experience, area, availability, motivation, status, admin_notes, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const map = await profilesMap(db, Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))));
    return rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const staffUpdateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected", "under_review"]),
      notes: z.string().trim().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin-helpers.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("staff_applications")
      .update({ status: data.status, admin_notes: data.notes ?? null } as any)
      .eq("id", data.id)
      .select("id, user_id, status")
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("staff_audit_logs").insert({
      executor_id: context.userId,
      action: `application_${data.status}`,
      target_id: (updated as any).user_id,
      details: { application_id: data.id, notes: data.notes ?? null },
    } as any);
    return updated;
  });

export const staffListMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { pickAdminClient } = await import("@/lib/admin-read.server");
    const { db } = await pickAdminClient(context.supabase);
    const { data, error } = await db
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "moderator", "support"]);
    if (error) throw new Error(error.message);
    const byUser = new Map<string, string[]>();
    for (const r of (data ?? []) as any[]) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
    const map = await profilesMap(db, Array.from(byUser.keys()));
    return Array.from(byUser.entries()).map(([user_id, roles]) => ({ user_id, roles, profile: map.get(user_id) ?? null }));
  });

export const staffListAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin-helpers.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("staff_audit_logs")
      .select("id, executor_id, action, target_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const ids = Array.from(new Set(rows.flatMap((r) => [r.executor_id, r.target_id]).filter(Boolean)));
    const map = await profilesMap(supabaseAdmin, ids);
    return rows.map((r) => ({ ...r, executor: map.get(r.executor_id) ?? null, target: map.get(r.target_id) ?? null }));
  });

// ===========================================================================
// SISTEMA DE PROMOÇÕES & METAS (SHADOW PROMOS)
// ===========================================================================

export const adminListPromotions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("promotions")
      .select("*")
      .order("priority", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSavePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string(),
      description: z.string().optional(),
      promo_type: z.enum(["automatic", "coupon", "community_goal"]),
      discount_value: z.number(),
      goal_target_value: z.number().optional(),
      active: z.boolean().default(true),
      code: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin-helpers.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...payload } = data;
    const res = id
      ? await supabaseAdmin.from("promotions").update(payload as any).eq("id", id).select().single()
      : await supabaseAdmin.from("promotions").insert(payload as any).select().single();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  });

// ===========================================================================
// AUDITORIA DE LICENÇAS
// ===========================================================================

export const adminGetLicenseHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ licenseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { data: history, error } = await context.supabase
      .from("license_history")
      .select("*")
      .eq("license_id", data.licenseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return history ?? [];
  });
