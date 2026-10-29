import { describe, expect, it } from "vitest";
import { publicWinnerRows, winnerNickname } from "../lib/winner-board";

describe("public winners list", () => {
  it("accepts plain nicknames", () => {
    expect(winnerNickname.parse("  Callioni  ")).toBe("Callioni");
    expect(winnerNickname.parse("Shadow_01")).toBe("Shadow_01");
  });
  it("rejects emails, IPs, phones, CPF and over-long names", () => {
    for (const v of ["person@example.com", "151.243.218.213", "123.456.789-00", "(11) 91234-5678", "a".repeat(25), "x"]) {
      expect(winnerNickname.safeParse(v).success).toBe(false);
    }
  });
  it("never publishes a stored row that contains personal data", () => {
    expect(publicWinnerRows([{ nickname: "Callioni" }, { nickname: "person@example.com" }])).toEqual([{ nickname: "Callioni" }]);
  });
});
