/**
 * Limpa um termo de busca antes de usá-lo em filtros .or()/.ilike() do banco.
 * Remove caracteres que mudam a estrutura do filtro (vírgula, parênteses, aspas,
 * curingas, barra invertida, dois-pontos) e limita o tamanho.
 */
export function safeSearch(input: unknown, max = 80): string {
  return String(input ?? "")
    .replace(/[,()"'%*\\:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
