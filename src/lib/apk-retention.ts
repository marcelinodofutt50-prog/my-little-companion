/**
 * Regras de retenção dos APKs (client-safe, sem acesso ao banco).
 *
 * Por que isso existe: cada APK enviado pelo cliente e cada APK assinado
 * devolvido ficavam guardados para sempre. Além de encher o armazenamento,
 * todo download consome banda — foi o que estourou a cota do projeto.
 *
 * Política:
 *  - o APK ORIGINAL do cliente é descartado assim que o job termina
 *    (assinado, falhado ou cancelado): ninguém precisa dele depois disso;
 *  - o APK ASSINADO fica disponível por 7 dias; se o cliente baixar antes,
 *    o arquivo é descartado 48h depois do primeiro download;
 *  - jobs que nunca foram concluídos somem em 7 dias;
 *  - o registro continua no banco (sem os arquivos) para o controle do teste
 *    grátis — só os arquivos pesados são apagados.
 */

export const APK_GRACE_AFTER_DOWNLOAD_MS = 48 * 60 * 60 * 1000;
export const APK_MAX_KEEP_MS = 7 * 24 * 60 * 60 * 1000;
/** Trava contra download em loop (cada repetição gasta banda). */
export const APK_MAX_DOWNLOADS = 8;

export type RetentionJob = {
  status: string;
  completed_at?: string | null;
  created_at?: string | null;
  downloaded_at?: string | null;
  purge_after?: string | null;
  purged_at?: string | null;
};

const ms = (v?: string | null) => (v ? new Date(v).getTime() : null);

/** Quando o arquivo assinado deve ser apagado, dado o estado atual do job. */
export function computePurgeAfter(job: RetentionJob, now = new Date()): string {
  const downloaded = ms(job.downloaded_at);
  const base = ms(job.completed_at) ?? ms(job.created_at) ?? now.getTime();
  const hardLimit = base + APK_MAX_KEEP_MS;
  if (downloaded) {
    // Nunca estende o prazo máximo: o menor dos dois vence.
    return new Date(Math.min(downloaded + APK_GRACE_AFTER_DOWNLOAD_MS, hardLimit)).toISOString();
  }
  return new Date(hardLimit).toISOString();
}

/** O job já pode ter os arquivos apagados? */
export function isPurgeDue(job: RetentionJob, now = new Date()): boolean {
  if (job.purged_at) return false;
  // Job em andamento nunca é tocado — o arquivo sumiria no meio do atendimento.
  const active = ["queued", "claimed", "sending", "processing"].includes(job.status);
  const deadline = ms(job.purge_after) ?? ms(computePurgeAfter(job, now));
  if (deadline === null) return false;
  if (active) {
    // Só descarta um job travado quando ele passou muito do prazo.
    const created = ms(job.created_at);
    return created !== null && now.getTime() > created + APK_MAX_KEEP_MS;
  }
  return now.getTime() >= deadline;
}

/** Mensagem exibida quando o cliente tenta baixar um arquivo já descartado. */
export const APK_EXPIRED_MESSAGE =
  "Este APK já foi removido do servidor por segurança e economia de espaço. " +
  "Envie o arquivo novamente para receber uma nova assinatura.";

/** Mensagem do limite de downloads repetidos. */
export const APK_DOWNLOAD_LIMIT_MESSAGE =
  `Limite de ${APK_MAX_DOWNLOADS} downloads deste arquivo atingido. ` +
  "Guarde o APK que você já baixou ou fale com o suporte.";
