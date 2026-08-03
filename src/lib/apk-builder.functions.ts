import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyBuildJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data, error } = await context.supabase
        .from("apk_build_jobs")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[getMyBuildJobs] Supabase error:", error);
        throw error;
      }
      return data ?? [];
    } catch (e) {
      console.error("[getMyBuildJobs] Unexpected error:", e);
      throw e;
    }
  });

export const createBuildJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => 
    z.object({
      appName: z.string().min(2).max(50),
      originalApkUrl: z.string().url(),
      originalIconUrl: z.string().url().optional(),
      dropperType: z.string().default('risada_kl'),
      config: z.record(z.string(), z.any()).optional().default({}),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { resolveRoles } = await import("@/lib/roles.server");
    const roles = await resolveRoles(context as any);
    
    if (!roles.isStaff) {
      const { data: license, error: lErr } = await context.supabase
        .from("licenses")
        .select("plan_slug")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lErr) {
         console.error("[createBuildJob] License fetch error:", lErr);
         throw new Error("Não foi possível verificar sua licença. Tente novamente.");
      }
      
      const { tierFromPlanSlug, getTierFeatures } = await import("@/lib/plans");
      const tier = tierFromPlanSlug(license?.plan_slug);
      const features = getTierFeatures(tier);
      
      if (!features.bypass_play_protect) {
        throw new Error("Seu plano não inclui acesso ao Shadow Signer.");
      }
    }

    // Use a more resilient insertion method for apk_build_jobs
    async function insertJob(p: any) {
      const result = await context.supabase.from("apk_build_jobs").insert(p).select("id").maybeSingle();
      if (result.error) console.error("[createBuildJob] Job insertion error:", result.error);
      return result;
    }

    const jobPayload = {
      user_id: context.userId,
      app_name: data.appName,
      original_apk_url: data.originalApkUrl,
      original_icon_url: data.originalIconUrl || null,
      status: "pending",
      progress: 0
    };

    let { data: job, error } = await insertJob(jobPayload);

    // Schema cache fallback (PGRST204)
    if (error && (error as any).code === "PGRST204") {
      console.warn("[createBuildJob] Schema mismatch, retrying minimal insert...");
      const { original_icon_url, ...fallback } = jobPayload;
      const retry = await insertJob(fallback);
      job = retry.data;
      error = retry.error;
    }

    if (error || !job) {
      throw error || new Error("Falha ao criar job de build. Verifique se a tabela 'apk_build_jobs' existe.");
    }

    await context.supabase.from("apk_dropper_configs").insert({
      job_id: job.id,
      dropper_type: data.dropperType,
      config_json: (data.config ?? {}) as any
    });

    return job;
  });