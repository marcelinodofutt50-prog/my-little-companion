import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { makeCaktoCallback, readCaktoCallback, verifyCaktoSignature } from "../lib/cakto-protocol.server";

const secret = "fixture-secret";
const now = 1794840000000;
const body = Buffer.from('{"event":"purchase_approved","data":{"name":"João"}}');

function headers(timestamp = String(now / 1000)) {
  const digest = createHmac("sha256", secret).update(timestamp + ".").update(body).digest("hex");
  return new Headers({ "X-Cakto-Timestamp": timestamp, "X-Cakto-Signature": "v1=" + digest });
}

describe("Cakto authentication", () => {
  it("checks the signed bytes before parsing", () => {
    expect(verifyCaktoSignature(secret, body, headers(), now)).toBe(true);
    expect(verifyCaktoSignature(secret, Buffer.concat([body, Buffer.from(" ")]), headers(), now)).toBe(false);
    expect(verifyCaktoSignature("wrong", body, headers(), now)).toBe(false);
  });

  it("rejects stale, future, malformed and unsigned deliveries", () => {
    expect(verifyCaktoSignature(secret, body, headers(String(now / 1000 - 301)), now)).toBe(false);
    expect(verifyCaktoSignature(secret, body, headers(String(now / 1000 + 301)), now)).toBe(false);
    expect(verifyCaktoSignature(secret, body, headers("NaN"), now)).toBe(false);
    expect(verifyCaktoSignature(secret, body, new Headers(), now)).toBe(false);
  });

  it("binds the callback to one order", () => {
    const order = "a150472b-0e03-40d6-88a2-e9f00d3fd5ed";
    const callback = makeCaktoCallback(order, secret);
    expect(readCaktoCallback(callback, secret)).toBe(order);
    expect(readCaktoCallback("b" + callback.slice(1), secret)).toBeNull();
    expect(readCaktoCallback(callback, "wrong")).toBeNull();
    expect(readCaktoCallback(order, secret)).toBeNull();
  });
});
