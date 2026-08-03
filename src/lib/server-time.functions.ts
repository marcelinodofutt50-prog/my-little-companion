import { createServerFn } from "@tanstack/react-start";

/**
 * Relógio autoritativo do servidor. O cliente usa isso para calcular o
 * countdown de expiração sem depender do relógio (possivelmente errado)
 * da máquina do usuário.
 */
export const getServerNow = createServerFn({ method: "GET" }).handler(async () => {
  return { now: new Date().toISOString() };
});
