/**
 * Travas de concorrência + trilha de auditoria de licenças.
 *
 * - `withOpLock`  → garante que a mesma operação (mesma chave) não roda duas
 *                   vezes ao mesmo tempo, mesmo com cliques repetidos ou o
 *                   cliente aberto em várias abas/sessões.
 * - `recordLicenseAudit` → registra QUEM mudou O QUÊ e POR QUÊ em cada licença
 *                   (troca de senha, sincronização com o painel, cupom, etc.).
 *
 * Fica fora dos arquivos de server function porque o bundler apaga código
 * irmão de `createServerFn`.
 */

export type AuditActorKind = "customer" | "staff" | "system" | "webhook";

export type LicenseAuditInput = {
  licenseId?: string | null;
  userId?: string | null;
  actorId?: string | null;
  actorKind?: AuditActorKind;
  eventType: string;
  reason?: string | null;
  yaarsaEmail?: string | null;
  panel?: string | null;
  expiresBefore?: string | null;
  expiresAfter?: string | null;
  details?: Record<string, unknown>;
};

/** Grava um evento de auditoria (best-effort: nunca derruba o fluxo do cliente). */
export async function recordLicenseAudit(input: LicenseAuditInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("license_audit_events" as any).insert({
      license_id: input.licenseId ?? null,
      user_id: input.userId ?? null,
      actor_id: input.actorId ?? null,
      actor_kind: input.actorKind ?? "system",
      event_type: input.eventType,
      reason: input.reason ?? null,
      yaarsa_email: input.yaarsaEmail ?? null,
      panel: input.panel ?? null,
      expires_before: input.expiresBefore ?? null,
      expires_after: input.expiresAfter ?? null,
      details: (input.details ?? {}) as any,
    } as any);
  } catch {
    /* auditoria nunca bloqueia a operação */
  }
}

export class OperationBusyError extends Error {
  constructor(message = "Esta ação já está sendo processada. Aguarde alguns segundos.") {
    super(message);
    this.name = "OperationBusyError";
  }
}

/** Tenta pegar a trava; devolve `false` se outra sessão já está executando. */
export async function acquireOpLock(key: string, ttlSeconds = 60, holder?: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("try_acquire_op_lock" as any, {
    _key: key,
    _ttl_seconds: ttlSeconds,
    _holder: holder ?? null,
  } as any);
  // Sem a trava distribuída, falhamos de forma segura para não duplicar operações.
  if (error) throw new Error("Não foi possível proteger esta operação contra duplicidade. Tente novamente.");
  return data !== false;
}

export async function releaseOpLock(key: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("release_op_lock" as any, { _key: key } as any);
  } catch {
    /* a trava expira sozinha pelo TTL */
  }
}

/**
 * Executa `fn` sob trava exclusiva. Se outra sessão já estiver rodando a mesma
 * chave, lança `OperationBusyError` com mensagem amigável.
 */
export async function withOpLock<T>(
  key: string,
  fn: () => Promise<T>,
  opts: { ttlSeconds?: number; busyMessage?: string; holder?: string } = {},
): Promise<T> {
  const got = await acquireOpLock(key, opts.ttlSeconds ?? 60, opts.holder);
  if (!got) throw new OperationBusyError(opts.busyMessage);
  try {
    return await fn();
  } finally {
    await releaseOpLock(key);
  }
}
