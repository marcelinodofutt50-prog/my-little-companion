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
    // Destrava jobs vencidos (evita fila travada bloqueando novos envios).
    try { await supabase.rpc("expire_stale_apk_jobs"); } catch { /* ignore */ }
    const [{ data: active }, consumedRes, pendingRes, totalRes, myOldest, globalQueue] = await Promise.all([
      supabase.rpc("has_active_play_protect", { _user_id: userId }),
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

    // Posição na fila global = quantos jobs pendentes entraram antes do meu.
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
    // Estimativa simples: ~8 min por APK à frente na fila.
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
      canSubmit: (hasActive || consumed === 0) && pending === 0,
      blockReason: pending > 0
        ? "Você já tem um APK sendo processado. Aguarde ele finalizar para enviar o próximo."
        : (!hasActive && consumed > 0)
          ? "Teste grátis já utilizado (1 por conta). Ative o plano Play Protect (R$ 450/mês) para continuar."
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

    // Reserva atômica do teste grátis (PK por usuário): duas abas em paralelo
    // não conseguem consumir dois testes.
    if (isFreeTrial) {
      const { error: trialErr } = await supabaseAdmin
        .from("apk_free_trials")
        .insert({ user_id: userId, job_id: jobId } as any);
      if (trialErr) {
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
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
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
    const safeName = (job.result_filename || "app-protegido.apk").replace(/[^\w.\-]+/g, "_");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("apk-results")
      .createSignedUrl(job.result_path, 60 * 60, { download: safeName });
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar link de download");
    return { url: signed.signedUrl, filename: safeName };
  });

/** Admin ou Suporte (moderador) — a fila do Play Protect é operada pelos dois. */
async function assertStaff(ctx: any) {
  const [a, m] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "moderator" }),
  ]);
  if (!a.data && !m.data) throw new Error("Forbidden");
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
    const { count: stillActive } = await supabaseAdmin
      .from("apk_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("cleared_at", null)
      .in("status", ["claimed", "sending", "processing"] as any);
    return { removed: list.length, skippedActive: stillActive ?? 0 };
  });

// Admin: clear finished jobs from the whole queue. Optionally scoped to a
// single user. Também marca como limpo em vez de apagar o histórico.
export const adminClearApkJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid().optional(),
    includeActive: z.boolean().optional(),
  }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const statuses = data.includeActive
      ? [...TERMINAL_STATUSES, ...PENDING_STATUSES]
      : [...TERMINAL_STATUSES, "queued"];
    let q = supabaseAdmin
      .from("apk_jobs")
      .select("id,status,source_path,result_path")
      .is("cleared_at", null)
      .in("status", statuses as any);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows } = await q;
    const list = (rows ?? []) as any[];
    if (!list.length) return { removed: 0 };
    await removeJobFiles(supabaseAdmin, list);
    const now = new Date().toISOString();
    const openIds = list.filter((r) => (PENDING_STATUSES as readonly string[]).includes(r.status)).map((r) => r.id);
    const doneIds = list.filter((r) => !(PENDING_STATUSES as readonly string[]).includes(r.status)).map((r) => r.id);
    if (openIds.length) {
      const { error } = await supabaseAdmin
        .from("apk_jobs")
        .update({ cleared_at: now, status: "cancelled", completed_at: now, source_path: "", result_path: null } as any)
        .in("id", openIds);
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


/**
 * Cliente: descarta um job recém-criado cujo upload falhou. Evita que a fila
 * fique travada com um job "na fila" sem arquivo e que o teste grátis seja
 * consumido por uma tentativa que nunca chegou ao servidor.
 */
export const abortApkJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("apk_jobs")
      .select("id,user_id,status,source_path")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!job) return { ok: false };
    if (job.status !== "queued") return { ok: false };
    // O arquivo existe no storage? Se existir, o envio foi real e o teste grátis é consumido.
    let uploadExists = false;
    try {
      if (job.source_path) {
        const dir = job.source_path.split("/").slice(0, -1).join("/");
        const name = job.source_path.split("/").pop();
        const { data: files } = await supabaseAdmin.storage.from("apk-uploads").list(dir);
        uploadExists = Boolean(files?.some((f: any) => f.name === name && (f.metadata?.size ?? 0) > 0));
      }
    } catch { /* ignore */ }
    try { if (job.source_path) await supabaseAdmin.storage.from("apk-uploads").remove([job.source_path]); } catch { /* ignore */ }
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("apk_jobs")
      .update({ status: "cancelled", cleared_at: now, completed_at: now, is_free_trial: false, source_path: "" } as any)
      .eq("id", job.id);
    // Só devolve o teste grátis se o arquivo realmente nunca chegou ao storage.
    if (!uploadExists) {
      await supabaseAdmin.from("apk_free_trials").delete().eq("user_id", context.userId).eq("job_id", job.id);
    }
    return { ok: true };
  });
