import { describe, expect, it } from "vitest";
import { findUsdtTrc20Transfer } from "../crypto-verify.server";

const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const DEST = "TVoSTYfgeTUpccvKJPmr9F9DdsMCDf4u5V";

describe("findUsdtTrc20Transfer", () => {
  it("aceita transferência do contrato USDT real para o destino esperado", () => {
    const match = findUsdtTrc20Transfer(
      [{ to_address: DEST, amount_str: "1000000", contract_address: USDT_TRC20 }],
      DEST,
    );
    expect(match?.amount_str).toBe("1000000");
  });

  it("rejeita token falso com outro contrato para o mesmo destino", () => {
    const match = findUsdtTrc20Transfer(
      [{ to_address: DEST, amount_str: "999999999", contract_address: "TFakeTokenContractAddress123456789" }],
      DEST,
    );
    expect(match).toBeUndefined();
  });

  it("rejeita USDT real enviado a outro destino", () => {
    const match = findUsdtTrc20Transfer(
      [{ to_address: "TOtherAddress111111111111111111111", amount_str: "1000000", contract_address: USDT_TRC20 }],
      DEST,
    );
    expect(match).toBeUndefined();
  });

  it("escolhe a transferência USDT real mesmo entre várias transferências", () => {
    const match = findUsdtTrc20Transfer(
      [
        { to_address: DEST, amount_str: "5", contract_address: "TFakeTokenContractAddress123456789" },
        { to_address: DEST, amount_str: "42000000", contract_address: USDT_TRC20 },
      ],
      DEST,
    );
    expect(match?.amount_str).toBe("42000000");
  });

  it("retorna undefined sem transferências", () => {
    expect(findUsdtTrc20Transfer([], DEST)).toBeUndefined();
  });
});
