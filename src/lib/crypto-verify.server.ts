/**
 * On-chain hash verification for BTC, ETH, USDT (ERC-20/TRC-20/BEP-20).
 * All calls hit public no-key endpoints. Never import from client bundles.
 */

export type CryptoNetwork = "bitcoin" | "ethereum" | "tron" | "bsc";

export type VerifyResult = {
  ok: boolean;
  found: boolean;
  confirmations: number;
  addressMatches: boolean;
  amountSats?: string;
  reason?: string;
};

const USDT_ERC20 = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const USDT_BEP20 = "0x55d398326f99059ff775485246999027b3197955";

// Multiple RPC endpoints so a single provider outage doesn't freeze verification.
const EVM_RPCS: Record<"ethereum" | "bsc", string[]> = {
  ethereum: [
    "https://cloudflare-eth.com",
    "https://ethereum-rpc.publicnode.com",
    "https://rpc.ankr.com/eth",
  ],
  bsc: [
    "https://bsc-dataseed1.binance.org",
    "https://bsc-rpc.publicnode.com",
    "https://rpc.ankr.com/bsc",
  ],
};

const BTC_ENDPOINTS = [
  { tx: (h: string) => `https://blockstream.info/api/tx/${h}`, tip: "https://blockstream.info/api/blocks/tip/height" },
  { tx: (h: string) => `https://mempool.space/api/tx/${h}`, tip: "https://mempool.space/api/blocks/tip/height" },
];

async function httpJson(url: string, init?: RequestInit): Promise<any> {
  const r = await fetch(url, { ...init, headers: { accept: "application/json", ...(init?.headers ?? {}) } });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.json();
}

async function rpc(network: "ethereum" | "bsc", method: string, params: unknown[]): Promise<any> {
  let lastErr: unknown;
  for (const url of EVM_RPCS[network]) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!r.ok) throw new Error(`rpc ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(`rpc error: ${j.error.message ?? "unknown"}`);
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all rpcs failed");
}


// ---------------- BTC ----------------
async function verifyBtc(hash: string, expectedAddress: string): Promise<VerifyResult> {
  let lastErr: string | undefined;
  for (const endpoint of BTC_ENDPOINTS) {
    try {
      const tx = await httpJson(endpoint.tx(hash));
      const tip = Number(await (await fetch(endpoint.tip)).text());
      const confirmed = tx?.status?.confirmed === true;
      const block = tx?.status?.block_height as number | undefined;
      const confirmations = confirmed && block && Number.isFinite(tip) ? Math.max(0, tip - block + 1) : 0;
      const outs: Array<{ scriptpubkey_address?: string; value?: number }> = tx?.vout ?? [];
      // Sum ALL outputs to expected address (handles multi-vout payments).
      let totalSats = 0n;
      let match = false;
      for (const o of outs) {
        if ((o.scriptpubkey_address ?? "").toLowerCase() === expectedAddress.toLowerCase()) {
          match = true;
          totalSats += BigInt(o.value ?? 0);
        }
      }
      return {
        ok: true,
        found: true,
        confirmations,
        addressMatches: match,
        amountSats: match ? totalSats.toString() : undefined,
      };
    } catch (e: any) {
      lastErr = e?.message ?? "lookup failed";
    }
  }
  return { ok: false, found: false, confirmations: 0, addressMatches: false, reason: `btc: ${lastErr ?? "all endpoints failed"}` };
}


// ---------------- EVM (ETH / BSC) ----------------
function decodeErc20Transfer(input: string): { to: string; amountHex: string } | null {
  // transfer(address,uint256) selector: 0xa9059cbb + 32B addr + 32B amount
  if (!input || input.length < 10 + 128) return null;
  if (input.slice(0, 10).toLowerCase() !== "0xa9059cbb") return null;
  const to = "0x" + input.slice(10 + 24, 10 + 64).toLowerCase(); // last 20 bytes of first param
  const amountHex = "0x" + input.slice(10 + 64, 10 + 128);
  return { to, amountHex };
}

async function verifyEvm(
  network: "ethereum" | "bsc",
  hash: string,
  expectedAddress: string,
  isUsdt: boolean,
): Promise<VerifyResult> {
  try {
    const [tx, receipt, tipHex] = await Promise.all([
      rpc(network, "eth_getTransactionByHash", [hash]),
      rpc(network, "eth_getTransactionReceipt", [hash]),
      rpc(network, "eth_blockNumber", []),
    ]);
    if (!tx) return { ok: true, found: false, confirmations: 0, addressMatches: false, reason: "tx not found" };
    if (!receipt || !receipt.blockNumber) {
      return { ok: true, found: true, confirmations: 0, addressMatches: false, reason: "not yet mined" };
    }
    const success = receipt.status === "0x1";
    if (!success) return { ok: true, found: true, confirmations: 0, addressMatches: false, reason: "tx reverted" };

    const txBlock = parseInt(receipt.blockNumber, 16);
    const tip = parseInt(tipHex, 16);
    const confirmations = Math.max(0, tip - txBlock + 1);

    const expected = expectedAddress.toLowerCase();
    let addressMatches = false;
    let amountSats: string | undefined;

    if (isUsdt) {
      const contract = network === "ethereum" ? USDT_ERC20 : USDT_BEP20;
      if ((tx.to ?? "").toLowerCase() !== contract) {
        return { ok: true, found: true, confirmations, addressMatches: false, reason: "not a USDT transfer contract" };
      }
      const decoded = decodeErc20Transfer(tx.input ?? "");
      if (!decoded) return { ok: true, found: true, confirmations, addressMatches: false, reason: "cannot decode transfer()" };
      addressMatches = decoded.to === expected;
      amountSats = BigInt(decoded.amountHex).toString();
    } else {
      addressMatches = (tx.to ?? "").toLowerCase() === expected;
      amountSats = tx.value ? BigInt(tx.value).toString() : undefined;
    }

    return { ok: true, found: true, confirmations, addressMatches, amountSats };
  } catch (e: any) {
    return { ok: false, found: false, confirmations: 0, addressMatches: false, reason: `${network}: ${e?.message ?? "lookup failed"}` };
  }
}

// ---------------- Tron (TRC-20 USDT) ----------------
async function verifyTron(hash: string, expectedAddress: string): Promise<VerifyResult> {
  try {
    const j = await httpJson(`https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(hash)}`);
    if (!j || !j.hash) return { ok: true, found: false, confirmations: 0, addressMatches: false, reason: "tx not found" };
    const confirmations = Number(j.confirmations ?? 0);
    const success = j.contractRet === "SUCCESS" || j.confirmed === true;
    if (!success && confirmations === 0) {
      return { ok: true, found: true, confirmations, addressMatches: false, reason: "not confirmed" };
    }
    const expected = expectedAddress; // Tron base58 is case-sensitive
    const trc20: Array<{ to_address?: string; amount_str?: string; contract_address?: string }> = j.trc20TransferInfo ?? [];
    const match = trc20.find((t) => t.to_address === expected);
    return {
      ok: true,
      found: true,
      confirmations,
      addressMatches: Boolean(match),
      amountSats: match?.amount_str,
    };
  } catch (e: any) {
    return { ok: false, found: false, confirmations: 0, addressMatches: false, reason: `tron: ${e?.message ?? "lookup failed"}` };
  }
}

export async function verifyOnChain(
  network: CryptoNetwork,
  hash: string,
  expectedAddress: string,
  coin: "BTC" | "ETH" | "USDT",
): Promise<VerifyResult> {
  const h = hash.trim();
  if (network === "bitcoin") return verifyBtc(h, expectedAddress);
  if (network === "tron") return verifyTron(h, expectedAddress);
  const evm = network as "ethereum" | "bsc";
  const isUsdt = coin === "USDT";
  const cleanHash = h.startsWith("0x") ? h : `0x${h}`;
  return verifyEvm(evm, cleanHash, expectedAddress, isUsdt);
}
