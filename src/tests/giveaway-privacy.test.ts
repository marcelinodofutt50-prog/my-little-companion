import { describe, expect, it } from "vitest";
import { publicGiveawayLabel, randomIndex, shuffledSample } from "../lib/giveaway-random";
import { containsPrivateData } from "../lib/privacy-patterns";

describe("Giveaway selection and recording privacy", () => {
  it("keeps nicknames but never publishes personal data", () => {
    expect(publicGiveawayLabel("Callioni")).toBe("Callioni");
    for (const label of [null, "", "person@example.com", "151.243.218.213", "senha: Secret123!", "123.456.789-00"]) {
      expect(publicGiveawayLabel(label)).toBe("Membro Shadow");
    }
  });
  it("rejects the uneven uint32 tail before selecting a winner", () => {
    const values = [0xffffffff, 7];
    expect(randomIndex(3, () => values.shift() ?? 0)).toBe(1);
    expect(randomIndex(1, () => 0xffffffff)).toBe(0);
    expect(() => randomIndex(0)).toThrow();
  });
  it("samples without duplicates or changing the original pool", () => {
    const original = Array.from({ length: 100 }, (_, i) => i);
    const sample = shuffledSample(original);
    expect(sample).toHaveLength(40);
    expect(new Set(sample).size).toBe(40);
    expect(original[0]).toBe(0);
  });
  it("recognizes dynamic credentials, emails, IDs and phones", () => {
    for (const text of ["pin: 123456", "token=secret", "test@example.org", "(11) 99999-1234", "f30d71ce-8934-47b5-b66c-6c4da9d9f256"]) expect(containsPrivateData(text)).toBe(true);
    expect(containsPrivateData("VPS Starter R$ 180/mês")).toBe(false);
  });
});