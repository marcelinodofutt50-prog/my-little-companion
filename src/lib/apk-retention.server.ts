import { computePurgeAfter, isPurgeDue, type RetentionJob } from "./apk-retention";

type Admin = any;

/** Apaga arquivos do storage sem derrubar o fluxo se algo já não existir. */
async function removeFiles(admin: Admin, bucket: string, paths: string[]) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  try {
    await admin.storage.from(bucket).remove(list);
  } catch (e) {
    console.error(`[apk-retention] falha ao apagar em ${bucket}:`, e);
  }
}

/**
 * Descarta o APK original assim que o job termina. O arquivo de origem não é
 * usado depois da assinatura e é a maior fonte de lixo no armazenamento.
 */
export async function dropApkSource(admin: Admin, jobId: string) {
  const { data: job } = await admin
    .from("apk_jobs")
    .select("id,source_path")
    .eq("id", jobId)
    .maybeSingle();
  if (!job?.source_path) return { removed: 0 };
  await removeFiles(admin, "apk-uploads", [job.source_path]);
  await admin.from("apk_jobs").update({ source_path: "" }).eq("id", jobId);
  return { removed: 1 };
}

/**
 * Varredura periódica: apaga os arquivos dos jobs cujo prazo venceu e marca o
 * registro como descartado. O registro em si permanece (é pequeno e sustenta o
 * controle do teste grátis).
 */
export async function purgeExpiredApkJobs(admin: Admin, now = new Date()) {
  const { data, error } = await admin
    .from("apk_jobs")
    .select("id,status,created_at,completed_at,downloaded_at,purge_after,purged_at,source_path,result_path")
    .is("purged_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as (RetentionJob & {
    id: string;
    source_path?: string | null;
    result_path?: string | null;
  })[];

  const due = rows.filter((r) => isPurgeDue(r, now));
  if (!due.length) {
    // Mantém o prazo calculado em dia para quem ainda não tem um definido.
    const missing = rows.filter((r) => !r.purge_after);
    for (const r of missing) {
      await admin.from("apk_jobs").update({ purge_after: computePurgeAfter(r, now) }).eq("id", r.id);
    }
    return { purged: 0, scheduled: missing.length };
  }

  await removeFiles(admin, "apk-uploads", due.map((r) => r.source_path ?? "").filter(Boolean));
  await removeFiles(admin, "apk-results", due.map((r) => r.result_path ?? "").filter(Boolean));

  const stamp = now.toISOString();
  const { error: upErr } = await admin
    .from("apk_jobs")
    .update({ purged_at: stamp, source_path: "", result_path: null })
    .in("id", due.map((r) => r.id));
  if (upErr) throw new Error(upErr.message);

  return { purged: due.length, scheduled: 0 };
}
