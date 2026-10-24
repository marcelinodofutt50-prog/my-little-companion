import { describe, expect, it, vi } from "vitest";
import { deliverServerRenewal } from "./renewal-delivery";
describe("confirmed server renewal", () => {
  it("never saves active access when the panel fails", async () => {
    const save = vi.fn(); const password = vi.fn();
    await expect(deliverServerRenewal({ paused: false, extend: async () => ({ Fail: "offline" }), applyPassword: password, save })).rejects.toThrow("validade");
    expect(save).not.toHaveBeenCalled(); expect(password).not.toHaveBeenCalled();
  });
  it("does not complete renewal without applying the saved password", async () => {
    const save = vi.fn();
    await expect(deliverServerRenewal({ paused: false, extend: async () => ({ Success: "updated" }), applyPassword: async () => ({ Fail: "password" }), save })).rejects.toThrow("senha");
    expect(save).not.toHaveBeenCalled();
  });
  it("saves only after panel and password confirmation", async () => {
    const order: string[] = [];
    await deliverServerRenewal({ paused: false,
      extend: async () => { order.push("extend"); return { Success: true }; },
      applyPassword: async () => { order.push("password"); return { Success: true }; },
      save: async () => { order.push("save"); } });
    expect(order).toEqual(["extend", "password", "save"]);
  });
  it("does not recreate paused access when the server is paid", async () => {
    const extend = vi.fn(); const password = vi.fn(); const save = vi.fn();
    await deliverServerRenewal({ paused: true, extend, applyPassword: password, save });
    expect(extend).not.toHaveBeenCalled(); expect(password).not.toHaveBeenCalled(); expect(save).toHaveBeenCalledOnce();
  });
});