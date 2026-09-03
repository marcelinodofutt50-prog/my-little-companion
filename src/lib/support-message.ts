/**
 * Formato estável de uma mensagem de suporte para a UI.
 *
 * A coluna `reply_to_id` (citação de mensagem) é opcional: quando o cache de
 * esquema do PostgREST está desatualizado, ou quando a mensagem foi gravada
 * pelo fallback sem citação, ela simplesmente não vem na linha. A UI nunca
 * deve quebrar por causa disso — normalizamos para `null`.
 */
export type SupportMessage = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  is_admin: boolean;
  is_system: boolean;
  body: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  reply_to_id: string | null;
  /** Identidade do atendente gravada diretamente na mensagem — funciona sem permissões extras. */
  sender_name: string | null;
  sender_role: string | null;
  sender_avatar_url: string | null;
  created_at: string;
};

export function normalizeSupportMessage(row: any, fallbackThreadId?: string): SupportMessage {
  return {
    id: String(row?.id ?? ""),
    thread_id: String(row?.thread_id ?? fallbackThreadId ?? ""),
    sender_id: row?.sender_id ?? null,
    is_admin: row?.is_admin === true,
    is_system: row?.is_system === true,
    body: row?.body ?? null,
    attachment_url: row?.attachment_url ?? null,
    attachment_type: row?.attachment_type ?? null,
    reply_to_id: row?.reply_to_id ?? null,
    sender_name: row?.sender_name ?? null,
    sender_role: row?.sender_role ?? null,
    sender_avatar_url: row?.sender_avatar_url ?? null,
    created_at: row?.created_at ?? new Date().toISOString(),
  };
}

export function normalizeSupportMessages(rows: any[] | null | undefined, fallbackThreadId?: string): SupportMessage[] {
  return (rows ?? []).map((r) => normalizeSupportMessage(r, fallbackThreadId));
}
