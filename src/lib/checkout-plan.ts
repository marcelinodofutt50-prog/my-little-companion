/** Keep catalog absence distinct from connection, permissions and MFA failures. */
export function requireCheckoutPlan<T>(plan: T | null, error: unknown): T {
  if (error) throw new Error("Não foi possível consultar o plano agora. Confira sua sessão e tente novamente em instantes.");
  if (!plan) throw new Error("Plano não encontrado");
  return plan;
}