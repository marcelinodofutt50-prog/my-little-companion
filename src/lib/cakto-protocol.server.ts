import { createHmac, timingSafeEqual } from "node:crypto";

export const CAKTO_AMOUNT = 750;
export const CAKTO_PLAN = "login-30d";
export const CAKTO_CHECKOUT = "https://pay.cakto.com.br/haxjxbp_1331078";

function matchesHex(expected: Buffer, actual: string) {
  return /^[0-9a-f]{64}$/.test(actual) && timingSafeEqual(expected, Buffer.from(actual, "hex"));
}

export function verifyCaktoSignature(
  secret: string,
  body: Uint8Array,
  headers: Headers,
  now = Date.now(),
) {
  const timestamp = headers.get("x-cakto-timestamp") ?? "";
  const signature = headers.get("x-cakto-signature") ?? "";
  if (!secret || !/^\d{10}$/.test(timestamp) || !signature.startsWith("v1=")) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp + ".").update(body).digest();
  return matchesHex(expected, signature.slice(3));
}

export function makeCaktoCallback(orderId: string, secret: string) {
  const tag = createHmac("sha256", secret).update("cakto-checkout:" + orderId).digest("hex");
  return orderId + "." + tag;
}

export function readCaktoCallback(value: string | null | undefined, secret: string) {
  if (!value || !secret) return null;
  const [orderId, tag, extra] = value.split(".");
  if (extra !== undefined || !tag || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(orderId)) {
    return null;
  }
  const expected = createHmac("sha256", secret).update("cakto-checkout:" + orderId).digest();
  return matchesHex(expected, tag) ? orderId : null;
}
