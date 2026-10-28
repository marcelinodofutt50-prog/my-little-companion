import { afterEach, describe, expect, it, vi } from "vitest";
import { CreatorReadTimeout, recoverCreatorRead } from "../creator-read-recovery";

afterEach(() => vi.useRealTimers());

describe("Creator read recovery", () => {
  it("recovers one transient failure", async () => {
    vi.useFakeTimers();
    const read = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue("owned data");
    const result = recoverCreatorRead(read, new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await result).toBe("owned data");
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("never retries permission failures", async () => {
    const read = vi.fn().mockRejectedValue({ code: "42501", message: "not_allowed" });
    await expect(recoverCreatorRead(read, new AbortController().signal)).rejects.toMatchObject({ code: "42501" });
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("aborts the old account request and does not retry it", async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const read = vi.fn((signal: AbortSignal) => { requestSignal = signal; return new Promise(() => {}); });
    const result = recoverCreatorRead(read, controller.signal);
    const assertion = expect(result).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await assertion;
    expect(requestSignal?.aborted).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("bounds hanging requests to two attempts", async () => {
    vi.useFakeTimers();
    const read = vi.fn(() => new Promise(() => {}));
    const result = recoverCreatorRead(read, new AbortController().signal);
    const assertion = expect(result).rejects.toBeInstanceOf(CreatorReadTimeout);
    await vi.runAllTimersAsync();
    await assertion;
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("cancels the delayed retry on leaving the page", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const read = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = recoverCreatorRead(read, controller.signal);
    const assertion = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await vi.runAllTimersAsync();
    await assertion;
    expect(read).toHaveBeenCalledTimes(1);
  });
});
