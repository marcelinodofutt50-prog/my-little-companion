// Client-side address format + network detection.
// Pure format validation — no on-chain calls, no checksum crypto.
// Purpose: label wallets with certainty ("this address IS a Tron address")
// and catch cases where the wrong string was pasted into the wrong slot.

export type ChainId = "bitcoin" | "ethereum" | "bsc" | "tron";

export type DetectResult = {
  ok: boolean;
  detected: ChainId[];
  matchesExpected: boolean;
  reason?: string;
};

// Bitcoin mainnet: legacy base58 (1.../3...) or bech32 (bc1...).
const BTC_BECH32 = /^bc1[023456789acdefghjklmnpqrstuvwxyz]{25,87}$/i;
const BTC_BASE58 = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const isBitcoin = (a: string) => BTC_BECH32.test(a) || BTC_BASE58.test(a);

// EVM (Ethereum + BSC share the exact same address format).
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const isEvm = (a: string) => EVM_RE.test(a);

// Tron: base58, starts with T, 34 chars total, base58 alphabet only.
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const isTron = (a: string) => TRON_RE.test(a);

export function detectAddress(address: string, expected: ChainId): DetectResult {
  const a = address.trim();
  const detected: ChainId[] = [];
  if (isBitcoin(a)) detected.push("bitcoin");
  if (isEvm(a)) detected.push("ethereum", "bsc");
  if (isTron(a)) detected.push("tron");

  if (detected.length === 0) {
    return { ok: false, detected, matchesExpected: false, reason: "Formato de endereço não reconhecido" };
  }
  const matchesExpected = detected.includes(expected);
  return {
    ok: matchesExpected,
    detected,
    matchesExpected,
    reason: matchesExpected ? undefined : `Endereço não corresponde à rede ${expected}`,
  };
}

export function networkLabel(chain: ChainId): { short: string; full: string } {
  switch (chain) {
    case "bitcoin":  return { short: "BTC",     full: "Bitcoin (mainnet)" };
    case "ethereum": return { short: "ERC-20",  full: "Ethereum (ERC-20)" };
    case "bsc":      return { short: "BEP-20",  full: "BNB Smart Chain (BEP-20)" };
    case "tron":     return { short: "TRC-20",  full: "Tron (TRC-20)" };
  }
}
