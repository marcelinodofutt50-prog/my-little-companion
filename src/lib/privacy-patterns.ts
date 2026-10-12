/** Shared detection for recording protection and public giveaway labels. */
export function containsPrivateData(text: string): boolean {
  return [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
    /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    /\b(?:senha|password|token|pin|chave pix)\s*[:=]\s*\S+/i,
  ].some((pattern) => pattern.test(text));
}