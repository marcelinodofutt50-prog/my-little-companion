import { describe, it, expect } from "vitest";
import { brlToUsd, formatMoney } from "@/lib/currency";

describe("preços em dólar para quem é de fora", () => {
  it("converte BRL para USD pela cotação, arredondando para x,99", () => {
    expect(brlToUsd(1700, 5.5)).toBe(309.99);
  });
  it("brasileiro continua vendo em reais", () => {
    expect(formatMoney(450, "BRL", 5.5)).toBe("R$\u00a0450,00");
  });
  it("estrangeiro vê em US$", () => {
    expect(formatMoney(450, "USD", 5.5)).toBe("$81.99");
  });
});
