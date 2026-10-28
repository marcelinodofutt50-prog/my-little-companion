import { describe, expect, it } from "vitest";
import { canOpenSupportUpload } from "../support-upload-access";

const thread = "11111111-1111-4111-8111-111111111111";
const owner = "33333333-3333-4333-8333-333333333333";
const staff = "44444444-4444-4444-8444-444444444444";

describe("support upload ticket access", () => {
  it("lets a customer attach a print in their own conversation", () => {
    expect(
      canOpenSupportUpload({ isStaff: false, threadOwnerId: owner, userId: owner }),
    ).toBe(true);
  });

  it("lets verified staff attach a print in a customer's conversation", () => {
    expect(
      canOpenSupportUpload({ isStaff: true, threadOwnerId: owner, userId: staff }),
    ).toBe(true);
  });

  it("refuses a customer attaching into someone else's conversation", () => {
    expect(
      canOpenSupportUpload({ isStaff: false, threadOwnerId: owner, userId: staff }),
    ).toBe(false);
  });

  it("refuses a conversation whose owner could not be read", () => {
    expect(
      canOpenSupportUpload({ isStaff: false, threadOwnerId: null, userId: owner }),
    ).toBe(false);
  });
});
