export type OrderReadResult = {
  error: { code?: string; message?: string } | null;
};

export const ORDER_READ_ERROR = "Não foi possível carregar seu histórico de pedidos. Tente novamente.";

export function findSchemaCacheReadError(results: OrderReadResult[]) {
  return results.find((result) =>
    result.error && (result.error.code === "PGRST108" || result.error.message?.includes("schema cache")),
  )?.error ?? null;
}

export function unresolvedOrderReadError(results: OrderReadResult[]) {
  return results.find((result) => result.error)?.error ?? null;
}
