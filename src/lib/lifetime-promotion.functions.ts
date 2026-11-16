import { createServerFn } from "@tanstack/react-start";

export const getLifetimePromotion = createServerFn({ method: "GET" }).handler(async () => {
  if (process.env["LIFETIME_PROMOTION_ENABLED"] !== "true") return null;
  const { lifetimePromotionWindow } = await import("./lifetime-promotion.server");
  const now = Date.now();
  return { ...lifetimePromotionWindow(now), now };
});

export const getLifetimePromotionLink = createServerFn({ method: "POST" }).handler(async () => {
  if (process.env["LIFETIME_PROMOTION_ENABLED"] !== "true") return null;
  const { lifetimePromotionWindow } = await import("./lifetime-promotion.server");
  return lifetimePromotionWindow().active ? "https://pay.cakto.com.br/3ehdy6q_1332037" : null;
});
