import { describe, expect, it } from "vitest";
import { detectAddress, networkLabel } from "./crypto-address";

// Production wallets currently displayed on /crypto. If any of these are
// edited, this test file is the deploy gate that catches an accidental swap.
const LIVE = {
  btc:        "bc1qlwyf3lhw9sz7q0n9x5kyrp826va3wtgumtrt4w",
  eth:        "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
  usdtErc20:  "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
  usdtTrc20:  "TVoSTYfgeTUpccvKJPmr9F9DdsMCDf4u5V",
  usdtBep20:  "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
};

describe("detectAddress — valid production wallets", () => {
  it("BTC bech32 matches bitcoin", () => {
    const r = detectAddress(LIVE.btc, "bitcoin");
    expect(r.matchesExpected).toBe(true);
    expect(r.detected).toContain("bitcoin");
  });

  it("ETH address matches ethereum", () => {
    const r = detectAddress(LIVE.eth, "ethereum");
    expect(r.matchesExpected).toBe(true);
    expect(r.detected).toEqual(expect.arrayContaining(["ethereum", "bsc"]));
  });

  it("USDT ERC-20 matches ethereum", () => {
    expect(detectAddress(LIVE.usdtErc20, "ethereum").matchesExpected).toBe(true);
  });

  it("USDT TRC-20 matches tron", () => {
    const r = detectAddress(LIVE.usdtTrc20, "tron");
    expect(r.matchesExpected).toBe(true);
    expect(r.detected).toEqual(["tron"]);
  });

  it("USDT BEP-20 matches bsc (EVM shape)", () => {
    expect(detectAddress(LIVE.usdtBep20, "bsc").matchesExpected).toBe(true);
  });
});

describe("detectAddress — cross-network mismatches must be rejected", () => {
  it("Tron address must NOT be accepted as Ethereum", () => {
    const r = detectAddress(LIVE.usdtTrc20, "ethereum");
    expect(r.matchesExpected).toBe(false);
    expect(r.detected).not.toContain("ethereum");
  });

  it("Tron address must NOT be accepted as BSC", () => {
    expect(detectAddress(LIVE.usdtTrc20, "bsc").matchesExpected).toBe(false);
  });

  it("EVM address must NOT be accepted as Tron", () => {
    expect(detectAddress(LIVE.eth, "tron").matchesExpected).toBe(false);
  });

  it("EVM address must NOT be accepted as Bitcoin", () => {
    expect(detectAddress(LIVE.eth, "bitcoin").matchesExpected).toBe(false);
  });

  it("BTC address must NOT be accepted as Ethereum", () => {
    expect(detectAddress(LIVE.btc, "ethereum").matchesExpected).toBe(false);
  });

  it("BTC address must NOT be accepted as Tron", () => {
    expect(detectAddress(LIVE.btc, "tron").matchesExpected).toBe(false);
  });
});

describe("detectAddress — invalid input", () => {
  it("empty string is rejected", () => {
    const r = detectAddress("", "ethereum");
    expect(r.ok).toBe(false);
    expect(r.detected).toEqual([]);
  });

  it("garbage is rejected on every chain", () => {
    for (const chain of ["bitcoin", "ethereum", "bsc", "tron"] as const) {
      expect(detectAddress("not-an-address", chain).matchesExpected).toBe(false);
    }
  });

  it("EVM address with wrong length is rejected", () => {
    expect(detectAddress("0xabc123", "ethereum").matchesExpected).toBe(false);
    expect(detectAddress("0x" + "a".repeat(41), "ethereum").matchesExpected).toBe(false);
  });

  it("EVM address missing 0x is rejected", () => {
    expect(detectAddress("b1fD336ec3227048ee2Fb4A293fD43eDAf7190C0", "ethereum").matchesExpected).toBe(false);
  });

  it("EVM address with non-hex chars is rejected", () => {
    expect(detectAddress("0x" + "Z".repeat(40), "ethereum").matchesExpected).toBe(false);
  });

  it("Tron address of wrong length is rejected", () => {
    expect(detectAddress("TVoSTYfgeTUpccvKJPmr9F9DdsMCDf4u5", "tron").matchesExpected).toBe(false);
    expect(detectAddress("TVoSTYfgeTUpccvKJPmr9F9DdsMCDf4u5VX", "tron").matchesExpected).toBe(false);
  });

  it("Tron address not starting with T is rejected", () => {
    expect(detectAddress("AVoSTYfgeTUpccvKJPmr9F9DdsMCDf4u5V", "tron").matchesExpected).toBe(false);
  });

  it("Tron address with base58-invalid chars (0/O/I/l) is rejected", () => {
    expect(detectAddress("T0oSTYfgeTUpccvKJPmr9F9DdsMCDf4u5V", "tron").matchesExpected).toBe(false);
    expect(detectAddress("TIoSTYfgeTUpccvKJPmr9F9DdsMCDf4u5V", "tron").matchesExpected).toBe(false);
  });

  it("BTC bech32 with wrong human-readable part is rejected", () => {
    // tb1... is testnet, must not pass as mainnet
    expect(detectAddress("tb1qlwyf3lhw9sz7q0n9x5kyrp826va3wtgumtrt4w", "bitcoin").matchesExpected).toBe(false);
  });

  it("addresses with surrounding whitespace are still validated (trimmed)", () => {
    expect(detectAddress(`   ${LIVE.usdtTrc20}   `, "tron").matchesExpected).toBe(true);
  });
});

describe("networkLabel", () => {
  it("returns stable labels for each chain", () => {
    expect(networkLabel("bitcoin").short).toBe("BTC");
    expect(networkLabel("ethereum").short).toBe("ERC-20");
    expect(networkLabel("bsc").short).toBe("BEP-20");
    expect(networkLabel("tron").short).toBe("TRC-20");

    expect(networkLabel("ethereum").full).toMatch(/Ethereum/);
    expect(networkLabel("bsc").full).toMatch(/BEP-20/);
    expect(networkLabel("tron").full).toMatch(/Tron/);
  });
});

// Integration-style sweep: mirrors the exact <WALLETS> table rendered by the
// /crypto page. If any row's expected chain drifts from its address, this
// test fails BEFORE the build ships.
describe("wallet catalog integration — all displayed addresses must validate", () => {
  const catalog: Array<{ label: string; address: string; expected: Parameters<typeof detectAddress>[1] }> = [
    { label: "BTC",         address: LIVE.btc,       expected: "bitcoin"  },
    { label: "ETH",         address: LIVE.eth,       expected: "ethereum" },
    { label: "USDT ERC-20", address: LIVE.usdtErc20, expected: "ethereum" },
    { label: "USDT TRC-20", address: LIVE.usdtTrc20, expected: "tron"     },
    { label: "USDT BEP-20", address: LIVE.usdtBep20, expected: "bsc"      },
  ];

  it.each(catalog)("$label ($expected) is valid for its declared network", ({ address, expected }) => {
    const r = detectAddress(address, expected);
    expect(r.matchesExpected, r.reason ?? "").toBe(true);
  });

  it("no catalog address accidentally validates on a foreign chain family", () => {
    // Tron ↔ EVM: totally different alphabets — must never overlap.
    for (const row of catalog) {
      const r = detectAddress(row.address, row.expected);
      if (row.expected === "tron") {
        expect(r.detected).not.toContain("ethereum");
        expect(r.detected).not.toContain("bsc");
      } else if (row.expected === "ethereum" || row.expected === "bsc") {
        expect(r.detected).not.toContain("tron");
        expect(r.detected).not.toContain("bitcoin");
      } else if (row.expected === "bitcoin") {
        expect(r.detected).not.toContain("tron");
        expect(r.detected).not.toContain("ethereum");
      }
    }
  });
});
