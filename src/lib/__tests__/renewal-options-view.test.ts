import { describe, expect, it } from "vitest";
import { shouldShowNoRenewalOptions } from "../renewal-options-view";

describe("renewal options empty state", () => {
  it("never claims there are no paid logins while options are loading", () => {
    expect(shouldShowNoRenewalOptions({ loggedIn: true, loading: true, error: null, optionCount: 0 })).toBe(false);
  });

  it("shows the empty state only after a successful loaded response", () => {
    expect(shouldShowNoRenewalOptions({ loggedIn: true, loading: false, error: null, optionCount: 0 })).toBe(true);
  });

  it("keeps the empty state hidden after a read failure", () => {
    expect(shouldShowNoRenewalOptions({ loggedIn: true, loading: false, error: "offline", optionCount: 0 })).toBe(false);
  });
});
