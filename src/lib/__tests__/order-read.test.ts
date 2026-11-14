import { describe, expect, it } from "vitest";
import { findSchemaCacheReadError, normalizeOrderStage, unresolvedOrderReadError } from "../order-read";

describe("order history read failures", () => {
  it("keeps an ordinary query failure visible instead of treating it as an empty history", () => {
    const failure = { code: "XX000", message: "connection failed" };
    expect(unresolvedOrderReadError([{ error: null }, { error: failure }])).toEqual(failure);
  });

  it("identifies only schema-cache failures for the privileged retry", () => {
    const schema = { code: "PGRST108", message: "schema cache" };
    expect(findSchemaCacheReadError([{ error: { code: "XX000", message: "offline" } }, { error: schema }])).toEqual(schema);
    expect(findSchemaCacheReadError([{ error: { code: "XX000", message: "offline" } }])).toBeNull();
  });

  it("accepts a fully successful read", () => {
    expect(unresolvedOrderReadError([{ error: null }, { error: null }, { error: null }])).toBeNull();
  });

  it("keeps paid distinct from delivered", () => {
    const stages = { pending: {}, paid: {}, delivered: {} };
    expect(normalizeOrderStage("paid", stages)).toBe("paid");
    expect(normalizeOrderStage("delivered", stages)).toBe("delivered");
  });

  it("never treats an unknown order state as delivered", () => {
    expect(normalizeOrderStage("unexpected", { pending: {}, delivered: {} })).toBe("pending");
  });
});
