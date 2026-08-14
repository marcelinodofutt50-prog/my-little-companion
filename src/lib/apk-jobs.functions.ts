import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_APK_BYTES = 50 * 1024 * 1024; // 50 MB (limite do storage)

// Statuses that "consume" the trial (only real successful/in-flight attempts).
const CONSUMED_STATUSES = ["queued", "claimed", "sending", "processing", "done"] as const;
const PENDING_STATUSES = ["queued", "claimed", "sending", "processing"] as const;

export const getPlayProtectStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Force expired stale jobs cleanup
    try { await supabase.rpc("expire_stale_apk_jobs"); } catch { /* ignore */ }

    // Check if the user has an active plan that specifically supports Play Protect
    const { hasActivePlayProtect } = await import("@/lib/play-protect-access.server");
    const active = await hasActivePlayProtect(userId);
    
    const [consumedRes, pendingRes, totalRes, myOldest, globalQueue] = await Promise.all([
      supabase.from("apk_free_trials").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("apk_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", PENDING_STATUSES as any).is("cleared_at", null),
      supabase.from("apk_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).is("cleared_at", null),
      supabase
        .from("apk_jobs")
        .select("id,created_at,status")
        .eq("user_id", userId)
        .in("status", PENDING_STATUSES as any)
        .is("cleared_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from("apk_jobs").select("id", { count: "exact", head: true }).in("status", PENDING_STATUSES as any).is("cleared_at", null),
    ]);
    
    const consumed = consumedRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    const total = totalRes.count ?? 0;
    const hasActive = Boolean(active);

    // Queue position
    let queuePosition: number | null = null;
    if (myOldest?.data?.created_at) {
      const { count } = await supabase
        .from("apk_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", PENDING_STATUSES as any)
        .is("cleared_at", null)
        .lt("created_at", myOldest.data.created_at);
      queuePosition = (count ?? 0) + 1;
    }
    const queueTotal = globalQueue.count ?? 0;
    const etaMinutes = queuePosition ? Math.max(5, queuePosition * 8) : null;

    return {
      hasActivePlan: hasActive,
      freeTrialUsed: consumed > 0,
      totalJobs: total,
      pendingJobs: pending,
      queuePosition,
      queueTotal,
      etaMinutes,
      currentStatus: (myOldest?.data?.status as string | undefined) ?? null,
      canSubmit: (hasActive || consumed === 0 || (consumed > 0 && total === 0)) && pending === 0,
      blockReason: pending > 0
        ? "Você já tem um APK sendo processado. Aguarde ele finalizar para enviar o próximo."
        : (!hasActive && consumed > 0 && total > 0)
          ? "Teste grátis já utilizado (1 por conta). Ative o plano Play Protect (R$ 450/mês) para continuar."
          : null,
    };
  });

export const createApkJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => {
    return z.object({
      filename: z.string().trim().min(1).max(200).regex(/\.apk$/i, "Arquivo precisa ter extensão .apk"),
      sizeBytes: z.number().int().positive().max(MAX_APK_BYTES),
      deviceId: z.string().trim().max(120).optional(),
      attrs: z.string().trim().max(600).optional(),
    }).parse(input);
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { hasActivePlayProtect } = await import("@/lib/play-protect-access.server");
    const [active, consumedRes, pendingRes] = await Promise.all([
      hasActivePlayProtect(userId),
      supabase.from("apk_free_trials").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("apk_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", PENDING_STATUSES as any).is("cleared_at", null),
    ]);
    const consumed = consumedRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    const hasActive = Boolean(active);
    const isFreeTrial = !hasActive && consumed === 0;

    if (pending > 0) {
      throw new Error("Você já tem um APK em processamento. Aguarde finalizar para enviar o próximo.");
    }
    if (!hasActive && consumed > 0) {
      throw new Error("Teste grátis já utilizado (1 por conta). Ative o plano Play Protect (R$ 450/mês) para continuar.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const jobId = crypto.randomUUID();
    const cleanName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const sourcePath = `${userId}/${jobId}/${cleanName}`;

    // Reserva atômica do teste grátis (PK por usuário + índice único por
    // aparelho): duas abas, ou duas contas no mesmo celular, não conseguem
    // consumir dois APKs grátis. Quem já paga passa direto, sem antifraude.
    if (isFreeTrial) {
      const { assessAbuse } = await import("@/lib/fraud-engine.server");
      const verdict = await assessAbuse({
        userId,
        action: "play_protect",
        device: { deviceId: data.deviceId, attrs: data.attrs },
      });
      if (!verdict.allowed) {
        throw new Error(
          `${verdict.message ?? "APK grátis indisponível para esta conta."} Assinantes do Play Protect não passam por esta verificação.`,
        );
      }

      const { error: trialErr } = await supabaseAdmin
        .from("apk_free_trials")
        .insert({
          user_id: userId,
          job_id: jobId,
          device_hash: verdict.deviceHash,
          attrs_hash: verdict.attrsHash,
          ip_hash: verdict.ipHash,
          ip_prefix_hash: verdict.ipPrefixHash,
        } as any);
      if (trialErr) {
        if (trialErr.code === "23505" && /device/i.test(trialErr.message ?? "")) {
          throw new Error("Este aparelho já usou o APK grátis. O benefício é 1 por pessoa — ative o plano Play Protect para continuar.");
        }
        throw new Error("Teste grátis já utilizado (1 por conta). Ative o plano Play Protect (R$ 450/mês) para continuar.");
      }
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("apk-uploads")
      .createSignedUploadUrl(sourcePath);
    if (signErr || !signed) {
      if (isFreeTrial) await supabaseAdmin.from("apk_free_trials").delete().eq("user_id", userId).eq("job_id", jobId);
      throw new Error(signErr?.message || "Falha ao gerar URL de upload");
    }

    const { error: insErr } = await supabase.from("apk_jobs").insert({
      id: jobId,
      user_id: userId,
      status: "queued",
      source_path: sourcePath,
      source_filename: cleanName,
      source_size_bytes: data.sizeBytes,
      is_free_trial: isFreeTrial,
    } as any);
    if (insErr) {
      if (isFreeTrial) await supabaseAdmin.from("apk_free_trials").delete().eq("user_id", userId).eq("job_id", jobId);
      throw new Error(insErr.message);
    }


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
      .is("cleared_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const cancelApkJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => {
    return z.object({ id: z.string().uuid() }).parse(input);
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("apk_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() } as any)
      .eq("id", data.id)
      .eq("user_id", userId)
      .in("status", ["queued", "claimed"] as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getApkResultDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => {
    return z.object({ id: z.string().uuid() }).parse(input);
  })
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
    const safeName = (job.result_filename || "app-protegido.apk").replace(/[^\w.\-]+/g, "_");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("apk-results")
      .createSignedUrl(job.result_path, 60 * 60, { 
        download: safeName,
        transform: undefined // Ensure no transformation for APKs
      });
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar link de download");
    return { url: signed.signedUrl, filename: safeName };
  });

/** Admin ou Suporte (moderador) — a fila do Play Protect é operada pelos dois. */
async function assertStaff(ctx: any) {
  const { assertStaffRole } = await import("@/lib/roles.server");
  await assertStaffRole(ctx);
}

// Admin
export const adminListApkJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("apk_jobs")
      .select("*")
      .is("cleared_at", null)
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
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("apk_jobs")
      .select("*")
      .is("cleared_at", null)
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
  await assertStaff(ctx);
}

// Admin: download original APK sent by client
export const adminGetApkSourceDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => {
    return z.object({ id: z.string().uuid() }).parse(input);
  })
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
    const safeName = (job.source_filename || "origem.apk").replace(/[^\w.\-]+/g, "_");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("apk-uploads")
      .createSignedUrl(job.source_path, 60 * 60, { download: safeName });
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar link");
    return { url: signed.signedUrl, filename: safeName };
  });

// Admin: create signed upload URL for the processed APK result
export const adminCreateApkResultUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => {
    return z.object({
      id: z.string().uuid(),
      filename: z.string().trim().min(1).max(200).regex(/\.apk$/i, "Arquivo precisa ter extensão .apk"),
    }).parse(input);
  })
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
  .validator((input: any) => {
    return z.object({
      id: z.string().uuid(),
      resultPath: z.string().min(1),
      filename: z.string().min(1),
      sizeBytes: z.number().int().positive(),
    }).parse(input);
  })
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
  .validator((input: any) => {
    return z.object({
      id: z.string().uuid(),
      reason: z.string().trim().min(1).max(400),
    }).parse(input);
  })
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

const TERMINAL_STATUSES = ["done", "failed", "expired", "cancelled"] as const;

async function removeJobFiles(admin: any, rows: any[]) {
  const sources = rows.map((r) => r.source_path).filter(Boolean);
  const results = rows.map((r) => r.result_path).filter(Boolean);
  try { if (sources.length) await admin.storage.from("apk-uploads").remove(sources); } catch { /* ignore */ }
  try { if (results.length) await admin.storage.from("apk-results").remove(results); } catch { /* ignore */ }
}

// Client: clear own finished jobs. Os registros continuam no banco (marcados
// como limpos) para preservar o controle do teste grátis, mas somem da lista
// e os arquivos são apagados do storage.
export const clearMyApkJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Só limpa jobs finalizados ou ainda na fila. Jobs que o time já começou a
    // processar (claimed/sending/processing) NÃO são apagados, senão o arquivo
    // some no meio do atendimento.
    const { data: rows } = await supabaseAdmin
      .from("apk_jobs")
      .select("id,status,source_path,result_path")
      .eq("user_id", context.userId)
      .is("cleared_at", null)
      .in("status", [...TERMINAL_STATUSES, "queued"] as any);
    const list = (rows ?? []) as any[];
    if (!list.length) return { removed: 0, skippedActive: 0 };
    await removeJobFiles(supabaseAdmin, list);
    const now = new Date().toISOString();
    const queuedIds = list.filter((r) => r.status === "queued").map((r) => r.id);
    const doneIds = list.filter((r) => r.status !== "queued").map((r) => r.id);
    if (queuedIds.length) {
      const { error } = await supabaseAdmin
        .from("apk_jobs")
        .update({ cleared_at: now, status: "cancelled", completed_at: now, source_path: "", result_path: null } as any)
        .in("id", queuedIds);
      if (error) throw new Error(error.message);
    }
    if (doneIds.length) {
      const { error } = await supabaseAdmin
        .from("apk_jobs")
        .update({ cleared_at: now, source_path: "", result_path: null } as any)
        .in("id", doneIds);
      if (error) throw new Error(error.message);
    }
    return { removed: list.length };
  });

export const adminClearApkJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("apk_jobs")
      .select("id,status,source_path,result_path")
      .is("cleared_at", null)
      .in("status", TERMINAL_STATUSES as any);
    const list = (rows ?? []) as any[];
    if (!list.length) return { removed: 0 };
    await removeJobFiles(supabaseAdmin, list);
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("apk_jobs")
      .update({ cleared_at: now, source_path: "", result_path: null } as any)
      .in("id", list.map((r) => r.id));
    if (error) throw new Error(error.message);
    return { removed: list.length };
  });
