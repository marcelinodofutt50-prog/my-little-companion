import { serverRenewalPlanSlug } from "./server-renewal";

const RENEWAL_OFFERS = {
  monthly: { amount: 450, label: "Renovação do servidor · 4.5.7", url: "https://pay.cakto.com.br/fktdd7t_1332924" },
  lifetime: { amount: 250, label: "Renovação do servidor · Vitalício", url: "https://pay.cakto.com.br/36weg6j_1332910" },
} as const;

type Order = { plan_slug: string; amount: number; status: string };
type License = {
  plan_slug: string;
  panel: string;
  is_legacy: boolean;
  is_trial: boolean;
  disabled_at: string | null;
};

export function resolveCaktoRenewalOffer(order: Order, license: License) {
  if (!["created", "pending"].includes(order.status) || license.is_trial || license.disabled_at) return null;
  const expectedPlan = serverRenewalPlanSlug(license);
  if (order.plan_slug !== expectedPlan) return null;

  if (license.plan_slug === "login-30d" && license.panel === "v457" &&
      order.amount === RENEWAL_OFFERS.monthly.amount) return RENEWAL_OFFERS.monthly;

  if (license.plan_slug === "login-lifetime" && license.panel === "v46" &&
      order.amount === RENEWAL_OFFERS.lifetime.amount) return RENEWAL_OFFERS.lifetime;

  return null;
}
