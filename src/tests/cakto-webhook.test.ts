import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleCaktoWebhook } from "../lib/cakto.server";
import { makeCaktoCallback } from "../lib/cakto-protocol.server";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  acquireOpLock: vi.fn(),
  releaseOpLock: vi.fn(),
  fulfillOrder: vi.fn(),
  setExpiryAnyPanel: vi.fn(),
  suspendAccountAnyPanel: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
vi.mock("../lib/audit-trail.server", () => ({
  acquireOpLock: mocks.acquireOpLock, releaseOpLock: mocks.releaseOpLock,
}));
vi.mock("../lib/fulfillment.server", () => ({ fulfillOrder: mocks.fulfillOrder }));
vi.mock("../lib/license-cron.server", () => ({
  setExpiryAnyPanel: mocks.setExpiryAnyPanel,
  suspendAccountAnyPanel: mocks.suspendAccountAnyPanel,
  yesterdayYmd: () => "2026-11-15",
}));

const secret = "fixture-signing-secret";
const callbackSecret = "fixture-callback-secret-for-tests";
const orderId = "a150472b-0e03-40d6-88a2-e9f00d3fd5ed";
const order = {
  id: "payment-1", offer_type: "main", product: { id: "product" }, offer: { id: "offer" },
  subscription: { id: "subscription" }, callback: makeCaktoCallback(orderId, callbackSecret),
  status: "paid", currency: "BRL", amount: 750, paidAt: "2026-11-16T17:00:00-03:00",
};

function request(event: string, data: unknown, key = secret) {
  const body = JSON.stringify({ event, data });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", key).update(timestamp + "." + body).digest("hex");
  return new Request("https://shadow.example/api/public/payments/cakto", {
    method: "POST",
    body,
    headers: { "X-Cakto-Timestamp": timestamp, "X-Cakto-Signature": "v1=" + signature },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CAKTO_WEBHOOK_SECRET", secret);
  vi.stubEnv("CAKTO_CALLBACK_SECRET", callbackSecret);
  vi.stubEnv("CAKTO_PRODUCT_ID", "product");
  vi.stubEnv("CAKTO_OFFER_ID", "offer");
  mocks.acquireOpLock.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("Cakto webhook", () => {
  it("rejects invalid signatures and amounts before writing", async () => {
    expect((await handleCaktoWebhook(request("purchase_approved", order, "wrong"))).status).toBe(401);
    expect((await handleCaktoWebhook(request("purchase_approved", { ...order, amount: 7.5 }))).status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("delivers the linked first order and handles repeated V2 deliveries", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { action: "fulfill", orderId } })
      .mockResolvedValueOnce({ data: { action: "done" } });
    mocks.fulfillOrder.mockResolvedValue({ ok: true });
    const data = [order, { ...order, offer_type: "orderbump" }];
    expect((await handleCaktoWebhook(request("purchase_approved", data))).status).toBe(204);
    expect((await handleCaktoWebhook(request("purchase_approved", data))).status).toBe(204);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_cakto_event", expect.objectContaining({
      p_order: orderId, p_payment: order.id, p_subscription: "subscription",
    }));
    expect(mocks.fulfillOrder).toHaveBeenCalledExactlyOnceWith(orderId);
  });

  it("uses only the provider subscription for renewal callbacks without a token", async () => {
    const expiry = "2026-12-16T20:00:00Z";
    mocks.rpc.mockResolvedValue({ data: { action: "sync", email: "license@example.test", panel: "v457", expiresAt: expiry } });
    mocks.setExpiryAnyPanel.mockResolvedValueOnce({ status: "failed" }).mockResolvedValueOnce({ status: "done" });
    const data = { ...order, callback: null, id: "payment-2" };
    expect((await handleCaktoWebhook(request("subscription_renewed", data))).status).toBe(503);
    expect((await handleCaktoWebhook(request("subscription_renewed", data))).status).toBe(204);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_cakto_event", expect.objectContaining({
      p_order: null, p_payment: "payment-2",
    }));
    expect(mocks.setExpiryAnyPanel).toHaveBeenNthCalledWith(2, "license@example.test", "v457", expiry);
  });

  it("preserves the paid term on cancellation and syncs revocation on refund", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { action: "done" } })
      .mockResolvedValueOnce({ data: { action: "revoke", email: "license@example.test", panel: "v457" } });
    mocks.suspendAccountAnyPanel.mockResolvedValue({ status: "done" });
    expect((await handleCaktoWebhook(request("subscription_canceled", order))).status).toBe(204);
    expect(mocks.suspendAccountAnyPanel).not.toHaveBeenCalled();
    expect((await handleCaktoWebhook(request("refund", { ...order, status: "refunded" }))).status).toBe(204);
    expect(mocks.suspendAccountAnyPanel).toHaveBeenCalledExactlyOnceWith("license@example.test", "v457", "2026-11-15");
  });
});
