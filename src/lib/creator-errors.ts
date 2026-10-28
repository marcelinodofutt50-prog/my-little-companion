const KNOWN: Record<string, string> = {
  not_allowed: "Confirme o código do 2FA e tente de novo.",
  not_creator: "Só Creators aprovados podem fazer isso.",
  invalid_url: "Link inválido. Use um link completo começando com https://",
  platform_not_allowed: "Aceitamos YouTube, TikTok, Instagram, Kwai, Facebook, Telegram ou X.",
  rate_limited: "Limite de 5 vídeos por dia. Envie o resto amanhã.",
  duplicate: "Esse vídeo já foi enviado.",
};

export const CREATOR_INVALID_URL = KNOWN.invalid_url;

/** Friendly, generic message for Creator RPC failures; never echoes raw database text. */
export function creatorErrorMessage(message?: string, code?: string): string {
  const known = Object.entries(KNOWN).find(([k]) => message?.includes(k))?.[1];
  if (known) return known;
  if (code === "PGRST202" || /could not find the function/i.test(message ?? "")) return "O sistema está atualizando. Recarregue a página (F5) e tente de novo.";
  if (/jwt|session|401/i.test(message ?? "")) return "Sua sessão expirou. Saia e entre de novo na conta.";
  return `Não deu agora. Tente de novo em instantes.${code ? ` (código ${code})` : ""}`;
}

/** Deleting: a real error is not the same as "video is no longer pending". */
export function deleteVideoOutcome(error: { message?: string; code?: string } | null, data: unknown): { ok: boolean; message?: string } {
  if (error) return { ok: false, message: creatorErrorMessage(error.message, error.code) };
  if (!data) return { ok: false, message: "Só dá para remover vídeos ainda em análise." };
  return { ok: true };
}
