// Helpers do sistema de recuperação de conta.
// Os códigos NUNCA são guardados em texto puro: salvamos apenas o hash SHA-256.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para evitar confusão
export const RECOVERY_CODE_COUNT = 8;

function randomChunk(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Ex.: "SHDW-7K2P-9QX4" */
export function generatePlainCode(): string {
  return `SHDW-${randomChunk(4)}-${randomChunk(4)}`;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
}

export async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`shadow-recovery:${normalizeCode(code)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
