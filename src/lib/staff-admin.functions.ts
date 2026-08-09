import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertStaff } from "@/lib/admin-helpers.server";

// ===========================================================================
// SISTEMA DE STAFF & HIERARQUIA
// ===========================================================================

export const staffListApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("staff_applications")
      .select("*, profile:profiles(email, full_name, display_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const staffUpdateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => 
    z.object({ 
      id: z.string().uuid(), 
      status: z.enum(['approved', 'rejected', 'under_review']),
      notes: z.string().optional()
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: updated, error } = await context.supabase
      .from("staff_applications")
      .update({ 
        status: data.status, 
        reviewed_at: new Date().toISOString(),
        reviewer_id: context.userId,
        reviewer_notes: data.notes
      } as any)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

// ===========================================================================
// SISTEMA DE PROMOÇÕES & METAS (SHADOW PROMOS)
// ===========================================================================

export const adminListPromotions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
      promo_type: z.enum(['automatic', 'coupon', 'community_goal']),
      discount_value: z.number(),
      goal_target_value: z.number().optional(),
      active: z.boolean().default(true),
      code: z.string().optional()
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...payload } = data;
    
    let res;
    if (id) {
      res = await supabaseAdmin.from("promotions").update(payload).eq("id", id).select().single();
    } else {
      res = await supabaseAdmin.from("promotions").insert(payload).select().single();
    }
    
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
    await assertStaff(context);
    const { data: history, error } = await context.supabase
      .from("license_history")
      .select("*")
      .eq("license_id", data.licenseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return history ?? [];
  });
