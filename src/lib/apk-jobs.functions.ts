import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_APK_BYTES = 200 * 1024 * 1024; // 200 MB

// Statuses that "consume" the trial (only real successful/in-flight attempts).
const CONSUMED_STATUSES = ["queued", "claimed", "sending", "processing", "done"] as const;
const PENDING_STATUSES = ["queued", "claimed", "sending", "processing"] as const;

export const getPlayProtectStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: active }, consumedRes, pendingRes, totalRes] = await Promise.all([
      supabase.rpc("has_active_play_protect", { _user_id: userId }),
      supabase.from("apk_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", CONSUMED_STATUSES as any),
      supabase.from("apk_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", PENDING_STATUSES as any),
      supabase.from("apk_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    const consumed = consumedRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    const total = totalRes.count ?? 0;
    const hasActive = Boolean(active);
    return {
      hasActivePlan: hasActive,
      freeTrialUsed: consumed > 0,
      totalJobs: total,
      pendingJobs: pending,
      canSubmit: (hasActive || consumed === 0) && pending === 0,
      blockReason: pending > 0
        ? "Você já tem um APK sendo processado. Aguarde ele finalizar para enviar o próximo."
        : (!hasActive && consumed > 0)
          ? "Teste grátis já utilizado. Ative o plano Play Protect Mensal para continuar."
          : null,
    };
  });

export const createApkJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      filename: z.string().trim().min(1).max(200).regex(/\.apk$/i, "Arquivo precisa ter extensão .apk"),
      sizeBytes: z.number().int().positive().max(MAX_APK_BYTES),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: active }, consumedRes, pendingRes] = await Promise.all([
      supabase.rpc("has_active_play_protect", { _user_id: userId }),
      supabase.from("apk_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", CONSUMED_STATUSES as any),
      supabase.from("apk_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", PENDING_STATUSES as any),
    ]);
    const consumed = consumedRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    const hasActive = Boolean(active);
    const isFreeTrial = !hasActive && consumed === 0;

    if (pending > 0) {
      throw new Error("Você já tem um APK em processamento. Aguarde finalizar para enviar o próximo.");
    }
    if (!hasActive && consumed > 0) {
      throw new Error("Teste grátis já utilizado. Ative o plano Play Protect Mensal para continuar.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const jobId = crypto.randomUUID();
    const cleanName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const sourcePath = `${userId}/${jobId}/${cleanName}`;

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("apk-uploads")
      .createSignedUploadUrl(sourcePath);
    if (signErr || !signed) throw new Error(signErr?.message || "Falha ao gerar URL de upload");

    const { error: insErr } = await supabase.from("apk_jobs").insert({
      id: jobId,
      user_id: userId,
      status: "queued",
      source_path: sourcePath,
      source_filename: cleanName,
      source_size_bytes: data.sizeBytes,
      is_free_trial: isFreeTrial,
    } as any);
    if (insErr) throw new Error(insErr.message);

    return { jobId, uploadUrl: signed.signedUrl, token: signed.token, path: sourcePath };
  });


export const listApkJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("apk_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const cancelApkJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("apk_jobs")
      .update({ status: "cancelled" } as any)
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "queued");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getApkResultDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase
      .from("apk_jobs")
      .select("id,status,result_path,result_filename")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!job) throw new Error("Job não encontrado");
    if (job.status !== "done" || !job.result_path) throw new Error("Resultado ainda não disponível");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("apk-results")
      .createSignedUrl(job.result_path, 60 * 10);
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar link de download");
    return { url: signed.signedUrl, filename: job.result_filename };
  });

// Admin
export const adminListApkJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("apk_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (rows ?? []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    let emails: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,email").in("id", ids);
      emails = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
    }
    return list.map((r) => ({ ...r, user_email: emails[r.user_id] ?? null }));
  });

// Admin: pending queue (hide done/cancelled/expired to keep área limpa)
export const adminListPendingApkJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("apk_jobs")
      .select("*")
      .in("status", ["queued", "claimed", "sending", "processing", "failed"])
      .order("created_at", { ascending: true })
      .limit(200);
    const list = (rows ?? []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    let emails: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,email").in("id", ids);
      emails = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
    }
    return list.map((r) => ({ ...r, user_email: emails[r.user_id] ?? null }));
  });

async function assertAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
}

// Admin: download original APK sent by client
export const adminGetApkSourceDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("apk_jobs")
      .select("id,source_path,source_filename,status")
      .eq("id", data.id)
      .maybeSingle();
    if (!job?.source_path) throw new Error("Job sem arquivo de origem");
    // Move to "processing" the first time an admin downloads the source
    if (["queued", "claimed"].includes(job.status)) {
      await supabaseAdmin.from("apk_jobs").update({ status: "processing", started_at: new Date().toISOString() } as any).eq("id", data.id);
    }
    const { data: signed, error } = await supabaseAdmin.storage
      .from("apk-uploads")
      .createSignedUrl(job.source_path, 60 * 15);
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar link");
    return { url: signed.signedUrl, filename: job.source_filename };
  });

// Admin: create signed upload URL for the processed APK result
export const adminCreateApkResultUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    filename: z.string().trim().min(1).max(200).regex(/\.apk$/i, "Arquivo precisa ter extensão .apk"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("apk_jobs")
      .select("id,user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!job) throw new Error("Job não encontrado");
    const cleanName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const resultPath = `${job.user_id}/${job.id}/result-${cleanName}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("apk-results")
      .createSignedUploadUrl(resultPath);
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar URL de upload");
    return { uploadUrl: signed.signedUrl, token: signed.token, path: resultPath };
  });

// Admin: mark job done after uploading result. resultPath is reconstructed
// server-side from job.user_id/job.id so admin cannot inject arbitrary paths.
export const adminCompleteApkJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    resultPath: z.string().min(1),
    filename: z.string().min(1),
    sizeBytes: z.number().int().positive(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("apk_jobs").select("id,user_id").eq("id", data.id).maybeSingle();
    if (!job) throw new Error("Job não encontrado");
    const expectedPrefix = `${job.user_id}/${job.id}/`;
    if (!data.resultPath.startsWith(expectedPrefix)) {
      throw new Error("Caminho de resultado inválido");
    }
    const { error } = await supabaseAdmin
      .from("apk_jobs")
      .update({
        status: "done",
        result_path: data.resultPath,
        result_filename: data.filename,
        result_size_bytes: data.sizeBytes,
        completed_at: new Date().toISOString(),
        error_message: null,
      } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: quick pending-count for sidebar badge / notifications
export const adminApkPendingCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("apk_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "claimed", "sending", "processing"]);
    return { count: count ?? 0 };
  });


// Admin: mark job failed with a reason for the client
export const adminFailApkJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    reason: z.string().trim().min(1).max(400),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("apk_jobs")
      .update({ status: "failed", error_message: data.reason, completed_at: new Date().toISOString() } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
