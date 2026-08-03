import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyBuildJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("apk_build_jobs")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createBuildJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => {
    return z.object({
      appName: z.string().min(2).max(50),
      originalApkUrl: z.string().url(),
      originalIconUrl: z.string().url().optional(),
      dropperType: z.string().default('risada_kl'),
      config: z.record(z.any()).optional(),
    }).parse(input);
  })
  .handler(async ({ data, context }) => {
    const { resolveRoles } = await import("@/lib/roles.server");
    const roles = await resolveRoles(context as any);
    
    if (!roles.isStaff) {
      const { data: license } = await context.supabase
        .from("licenses")
        .select("plan_slug")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const { tierFromPlanSlug, getTierFeatures } = await import("@/lib/plans");
      const tier = tierFromPlanSlug(license?.plan_slug);
      const features = getTierFeatures(tier);
      
      if (!features.bypass_play_protect) {
        throw new Error("Seu plano não inclui acesso ao Shadow Signer.");
      }
    }

    const { data: job, error } = await context.supabase
      .from("apk_build_jobs")
      .insert({
        user_id: context.userId,
        app_name: data.appName,
        original_apk_url: data.originalApkUrl,
        original_icon_url: data.originalIconUrl,
        status: "pending",
        progress: 0
      })
      .select("id")
      .single();

    if (error) throw error;

    await context.supabase.from("apk_dropper_configs").insert({
      job_id: job.id,
      dropper_type: data.dropperType,
      config_json: (data.config ?? {}) as any
    });

    return job;
  });
