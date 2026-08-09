import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Helper to check if user has a specific permission
async function hasPermission(ctx: { supabase: any; userId: string }, permission: string) {
  const { data: hasPerm } = await ctx.supabase.rpc("has_permission", { 
    _user_id: ctx.userId, 
    _permission: permission 
  });
  return !!hasPerm;
}

export const submitStaffApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({
    full_name: z.string().min(3),
    discord_tag: z.string().optional(),
    experience: z.string().min(10),
    area: z.string(),
    availability: z.string(),
    motivation: z.string().min(20)
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("staff_applications").insert({
      user_id: userId,
      ...data
    });
    if (error) throw error;
    return { success: true };
  });

export const listStaffApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasPermission(context, "applications.view"))) throw new Error("Forbidden");
    const { supabase } = context;
    const { data, error } = await supabase
      .from("staff_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["pending", "reviewing", "approved", "rejected", "archived"]),
    admin_notes: z.string().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await hasPermission(context, "applications.review"))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("staff_applications")
      .update({ status: data.status, admin_notes: data.admin_notes })
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const getStaffHierarchy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("staff_roles")
      .select("*, role_permissions(permission_id, staff_permissions(name))")
      .order("hierarchy_level", { ascending: true });
    if (error) throw error;
    return data;
  });
