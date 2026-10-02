import { describe, it, expect } from "vitest";
import { isSubtypeRejected } from "../yaarsa.server";

describe("isSubtypeRejected", () => {
  it("reconhece o erro real do painel", () => {
    expect(isSubtypeRejected("Error: SQLSTATE[01000]: Warning: 1265 Data truncated for column 'subtype' at row 1")).toBe(true);
  });
  it("ignora outros erros", () => {
    expect(isSubtypeRejected("this email is already in use and active.")).toBe(false);
    expect(isSubtypeRejected(null)).toBe(false);
  });
});
