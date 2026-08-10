/**
 * Fetch live BRL price for crypto assets. Free CoinGecko endpoint, no key.
 * 5-minute in-memory cache so we don't hammer the API per verification.
 */
type Coin = "BTC" | "ETH" | "USDT";

const CG_ID: Record<Coin, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
};

type CacheEntry = { price: number; ts: number };
const cache = new Map<Coin, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

const FALLBACK_BRL: Record<Coin, number> = {
  // Emergency fallback used only if every API is down.
  // Deliberately conservative (over-estimates crypto price) so we never
  // release a license below the plan value.
  BTC: 300000,
  ETH: 12000,
  USDT: 5,
};

export async function getBrlPrice(coin: Coin): Promise<{ price: number; source: string }> {
  const now = Date.now();
  const cached = cache.get(coin);
  if (cached && now - cached.ts < TTL_MS) return { price: cached.price, source: "cache" };

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${CG_ID[coin]}&vs_currencies=brl`;
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (r.ok) {
      const j = (await r.json()) as Record<string, { brl?: number }>;
      const price = j[CG_ID[coin]]?.brl;
      if (typeof price === "number" && price > 0) {
        cache.set(coin, { price, ts: now });
        return { price, source: "coingecko" };
      }
    }
  } catch { /* fall through */ }

  // Second-chance: Binance ticker (USDT pair) — approximates BRL via USDT≈R$5 later.
  try {
    if (coin !== "USDT") {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}BRL`);
      if (r.ok) {
        const j = (await r.json()) as { price?: string };
        const price = Number(j.price);
        if (Number.isFinite(price) && price > 0) {
          cache.set(coin, { price, ts: now });
          return { price, source: "binance" };
        }
      }
    }
  } catch { /* fall through */ }

  return { price: FALLBACK_BRL[coin], source: "fallback" };
}

/**
 * Convert an on-chain raw amount (base units) into BRL.
 * decimals: BTC=8, ETH=18, USDT(ERC/BEP)=6, USDT(TRC)=6.
 */
export function toBrl(rawAmount: string | bigint, decimals: number, pricePerUnitBrl: number): number {
  const raw = typeof rawAmount === "bigint" ? rawAmount : BigInt(rawAmount || "0");
  // Do the divide in float-safe way (crypto amounts are small enough).
  const whole = Number(raw) / 10 ** decimals;
  return whole * pricePerUnitBrl;
}

export function decimalsFor(coin: Coin, network: "bitcoin" | "ethereum" | "tron" | "bsc"): number {
  if (coin === "BTC") return 8;
  if (coin === "ETH") return 18;
  // USDT: 6 on Ethereum, 6 on Tron, 18 on BSC (BEP-20 USDT is 18!)
  if (network === "bsc") return 18;
  return 6;
}
