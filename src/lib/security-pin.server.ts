/**
 * PIN de segurança do cliente.
 *
 * Regra: a equipe só enxerga dados sensíveis de login (e-mail + senha do
 * painel) depois que o cliente informar o PIN dele. Todo uso bem-sucedido
 * queima o PIN e gera um novo automaticamente, então um PID vazado vale
 * uma única consulta.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePin(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

export function normalizePin(v: string): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Devolve o PIN atual do cliente, criando um se ainda não existir. */
export async function getOrCreatePin(admin: any, userId: string): Promise<{
  pin: string;
  rotatedAt: string | null;
  lastUsedAt: string | null;
}> {
  const { data } = await admin
    .from("security_pins")
    .select("pin, rotated_at, last_used_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.pin) {
    return { pin: data.pin, rotatedAt: data.rotated_at ?? null, lastUsedAt: data.last_used_at ?? null };
  }

  const pin = generatePin();
  await admin.from("security_pins").upsert(
    { user_id: userId, pin, rotated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  return { pin, rotatedAt: new Date().toISOString(), lastUsedAt: null };
}

/** Força a troca do PIN (usado pelo cliente ou após uma consulta da equipe). */
export async function rotatePin(admin: any, userId: string): Promise<string> {
  const pin = generatePin();
  await admin.from("security_pins").upsert(
    { user_id: userId, pin, rotated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  return pin;
}

export type PinCheck =
  | { ok: true; newPin: string }
  | { ok: false; reason: "no_pin" | "wrong_pin" | "unavailable" };

/**
 * Confere o PIN informado pela equipe e, se bater, queima o PIN gerando outro.
 * Comparação em tempo constante para não vazar prefixo por timing.
 */
export async function verifyAndConsumePin(admin: any, userId: string, provided: string): Promise<PinCheck> {
  if (!admin) return { ok: false, reason: "unavailable" };

  const { data } = await admin
    .from("security_pins")
    .select("pin, uses_count")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.pin) return { ok: false, reason: "no_pin" };

  const a = normalizePin(provided);
  const b = normalizePin(data.pin);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  if (diff !== 0) return { ok: false, reason: "wrong_pin" };

  const newPin = generatePin();
  await admin
    .from("security_pins")
    .update({
      pin: newPin,
      rotated_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
      uses_count: (data.uses_count ?? 0) + 1,
    })
    .eq("user_id", userId);

  return { ok: true, newPin };
}

export async function logPinReveal(admin: any, row: {
  userId: string;
  staffId?: string | null;
  staffEmail?: string | null;
  licenseId?: string | null;
  scope?: string;
  success: boolean;
  details?: Record<string, unknown>;
}) {
  try {
    await admin.from("pin_reveal_logs").insert({
      user_id: row.userId,
      staff_id: row.staffId ?? null,
      staff_email: row.staffEmail ?? null,
      license_id: row.licenseId ?? null,
      scope: row.scope ?? "license_access",
      success: row.success,
      details: row.details ?? {},
    });
  } catch {
    /* auditoria é best-effort */
  }
}

/** Janela em que a equipe fica liberada após o cliente enviar o PIN no chat. */
export const CHAT_GRANT_MINUTES = 30;

/** Registra que o cliente liberou a consulta enviando o PIN no chat. */
export async function grantChatAccess(admin: any, userId: string, threadId?: string | null) {
  await logPinReveal(admin, {
    userId,
    scope: "chat_grant",
    success: true,
    details: { threadId: threadId ?? null, minutes: CHAT_GRANT_MINUTES },
  });
}

/** A equipe pode revelar sem digitar PIN enquanto a liberação do chat estiver válida. */
export async function hasActiveChatGrant(admin: any, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - CHAT_GRANT_MINUTES * 60_000).toISOString();
  const { data } = await admin
    .from("pin_reveal_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("scope", "chat_grant")
    .eq("success", true)
    .gte("created_at", since)
    .limit(1);
  return (data ?? []).length > 0;
}
