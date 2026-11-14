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

/** Unknown states must never fall back to "delivered". */
export function normalizeOrderStage<T extends string>(stage: string, stages: Record<T, unknown>): T {
  return Object.prototype.hasOwnProperty.call(stages, stage) ? (stage as T) : ("pending" as T);
}
