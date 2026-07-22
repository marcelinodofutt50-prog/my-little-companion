import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/**
 * Cron-triggered crypto payment poller.
 * Reads pending/verifying rows, refreshes their on-chain confirmations,
 * and auto-fulfills any that reach the required confirmation threshold.
 */
async function processBatch() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { verifyOnChain } = await import("@/lib/crypto-verify.server");
  const { fulfillCryptoPayment } = await import("@/lib/crypto-fulfill.server");

  const staleCutoff = new Date(Date.now() - 90_000).toISOString();
  // Fetch stale rows AND never-checked rows in a single query.
  const { data: rows } = await supabaseAdmin
    .from("crypto_payments")
    .select("*")
    .in("status", ["pending", "verifying", "confirmed"])
    .or(`last_checked_at.is.null,last_checked_at.lt.${staleCutoff}`)
    .order("created_at", { ascending: true })
    .limit(30);

  const all = rows ?? [];
  const results: Array<{ id: string; status: string; confirmations: number; note?: string }> = [];


  for (const p of all) {
    // Confirmed rows skip verification and go straight to fulfillment.
    if (p.status === "confirmed") {
      const f = await fulfillCryptoPayment(p.id);
      results.push({ id: p.id, status: f.ok ? "fulfilled" : "confirmed", confirmations: p.confirmations, note: f.reason });
      continue;
    }

    try {
      const network = p.network as "bitcoin" | "ethereum" | "tron" | "bsc";
      const coin = p.coin as "BTC" | "ETH" | "USDT";
      const res = await verifyOnChain(network, p.tx_hash, p.expected_address, coin);
      let nextStatus: "pending" | "verifying" | "confirmed" | "rejected" | "fulfilled" | "failed" = p.status as any;
      let failReason: string | null = p.failure_reason ?? null;
      let verifiedAt: string | null = p.verified_at ?? null;

      // Compute BRL-equivalent amount once we can see the transfer.
      let amountCrypto: number | null = p.amount_crypto ?? null;
      let amountBrlVerified: number | null = p.amount_brl_verified ?? null;
      let fxRate: number | null = p.fx_rate_brl ?? null;
      if (res.ok && res.found && res.addressMatches && res.amountSats && amountBrlVerified == null) {
        try {
          const { getBrlPrice, toBrl, decimalsFor } = await import("@/lib/crypto-price.server");
          const { price } = await getBrlPrice(coin);
          const decs = decimalsFor(coin, network);
          amountCrypto = Number(BigInt(res.amountSats)) / 10 ** decs;
          amountBrlVerified = toBrl(res.amountSats, decs, price);
          fxRate = price;
        } catch { /* keep nulls; guard will refuse if plan expects a value */ }
      }

      if (!res.ok) {
        // transient lookup failure — keep status
      } else if (!res.found) {
        nextStatus = "pending";
      } else if (!res.addressMatches) {
        nextStatus = "rejected";
        failReason = res.reason ?? "endereço de destino não confere";
      } else if (res.confirmations >= (p.required_confirmations ?? 6)) {
        nextStatus = "confirmed";
        verifiedAt = new Date().toISOString();
      } else {
        nextStatus = "verifying";
      }
      await supabaseAdmin.from("crypto_payments").update({
        last_checked_at: new Date().toISOString(),
        confirmations: res.confirmations,
        status: nextStatus,
        failure_reason: failReason,
        verified_at: verifiedAt,
        amount_crypto: amountCrypto,
        amount_brl_verified: amountBrlVerified,
        fx_rate_brl: fxRate,
      }).eq("id", p.id);

      if (nextStatus === "confirmed") {
        const f = await fulfillCryptoPayment(p.id);
        results.push({ id: p.id, status: f.ok ? "fulfilled" : "confirmed", confirmations: res.confirmations, note: f.reason });
      } else {
        results.push({ id: p.id, status: nextStatus, confirmations: res.confirmations, note: res.reason });
      }
    } catch (e: any) {
      results.push({ id: p.id, status: p.status, confirmations: p.confirmations, note: `error: ${e?.message ?? "unknown"}` });
    }
  }


  return results;
}

function verifyCronSecret(request: Request): boolean {
  const provided = request.headers.get("x-cron-secret") ?? "";
  const expected = process.env.CRON_TRIGGER_TOKEN ?? "";
  if (!expected) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/hooks/crypto-poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return new Response("unauthorized", { status: 401 });
        const results = await processBatch();
        return Response.json({ ok: true, processed: results.length, results });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
