import { createHash } from "node:crypto";

/**
 * Impressão digital de uma senha (SHA-256 hex). Usada apenas para comparar se
 * a senha guardada continua sendo a original do cliente e para garantir que a
 * senha temporária gerada durante a pausa nunca seja restaurada por engano.
 * Nunca gravamos a senha temporária em texto nem cifrada.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
