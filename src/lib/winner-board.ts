import { z } from "zod";
import { containsPrivateData } from "./privacy-patterns";

export const winnerNickname = z.string().trim().min(2).max(24)
  .regex(/^[\p{L}\p{N}_. -]+$/u, "Use somente letras, números, espaços, ponto, hífen ou sublinhado.")
  .refine((value) => !containsPrivateData(value), "Informe um apelido, sem dados pessoais.");

export function publicWinnerRows(rows: { nickname: string }[]): { nickname: string }[] {
  return rows.flatMap((row) => {
    const parsed = winnerNickname.safeParse(row.nickname);
    return parsed.success ? [{ nickname: parsed.data }] : [];
  });
}
