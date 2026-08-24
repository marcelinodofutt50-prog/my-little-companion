import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Checagem de acesso da equipe. A antiga RPC `has_permission` nunca existiu no
 * banco, então TODA leitura de candidaturas retornava "Forbidden".
 */
async function isStaffUser(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("is_staff", { _user_id: ctx.userId });
  return !!data;
}

async function isAdminUser(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  return !!data;
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
    const { data: existing } = await supabase
      .from("staff_applications")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["pending", "reviewing"])
      .maybeSingle();
    if (existing) throw new Error("Você já tem uma candidatura em análise. Aguarde o retorno da equipe.");

    const { error } = await supabase.from("staff_applications").insert({
      user_id: userId,
      status: "pending",
      ...data
    });
    if (error) throw error;
    return { success: true };
  });

export const listStaffApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isStaffUser(context))) throw new Error("Acesso restrito à equipe.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("staff_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = Array.from(new Set((data ?? []).map((a: any) => a.user_id)));
    const emails = new Map<string, string>();
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, display_name")
        .in("id", ids);
      for (const p of profiles ?? []) emails.set((p as any).id, (p as any).email ?? (p as any).display_name ?? "");
    }
    return (data ?? []).map((a: any) => ({ ...a, email: emails.get(a.user_id) ?? null }));
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["pending", "reviewing", "approved", "rejected", "archived"]),
    admin_notes: z.string().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context))) throw new Error("Apenas administradores podem revisar candidaturas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("staff_applications")
      .update({ status: data.status, admin_notes: data.admin_notes })
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const getMyStaffApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("staff_applications")
      .select("id, status, area, created_at, admin_notes")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
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
