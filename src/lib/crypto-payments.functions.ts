import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_PLAN_SLUGS = ["login-7d", "login-30d", "login-lifetime"] as const;
const NETWORKS = ["bitcoin", "ethereum", "tron", "bsc"] as const;

const HASH_RE = {
  bitcoin: /^[a-f0-9]{64}$/i,
  ethereum: /^0x[a-f0-9]{64}$/i,
  bsc: /^0x[a-f0-9]{64}$/i,
  tron: /^[a-f0-9]{64}$/i,
} as const;

export const submitCryptoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      planSlug: z.enum(ALLOWED_PLAN_SLUGS),
      network: z.enum(NETWORKS),
      coin: z.enum(["BTC", "ETH", "USDT"]),
      txHash: z.string().trim().min(60).max(80),
      proofBase64: z.string().min(100).max(8_500_000).optional(), // ~6MB decoded
      proofMime: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, supabaseAdmin, userId } = {
      supabase: context.supabase,
      userId: context.userId,
      supabaseAdmin: (await import("@/integrations/supabase/client.server")).supabaseAdmin,
    };

    // ---- 1. Format validation ----
    const hash = data.txHash.trim();
    const re = HASH_RE[data.network];
    if (!re.test(hash)) {
      throw new Error(
        data.network === "bitcoin" || data.network === "tron"
          ? "Hash inválido: esperado 64 caracteres hexadecimais."
          : "Hash inválido: esperado 0x + 64 caracteres hexadecimais."
      );
    }

    // ---- 2. Resolve plan + expected address ----
    const { data: plan, error: planErr } = await supabase
      .from("plans").select("slug, name, price_brl, active, category")
      .eq("slug", data.planSlug).eq("active", true).maybeSingle();
    if (planErr || !plan) throw new Error("Plano indisponível.");
    if (plan.category !== "license") throw new Error("Pagamento em crypto disponível apenas para planos de licença.");

    const EXPECTED: Record<string, string> = {
      "bitcoin:BTC": "bc1qlwyf3lhw9sz7q0n9x5kyrp826va3wtgumtrt4w",
      "ethereum:ETH": "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
      "ethereum:USDT": "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
      "tron:USDT": "TVoSTYfgeTUpccvKJPmr9F9DdsMCDf4u5V",
      "bsc:USDT": "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
    };
    const key = `${data.network}:${data.coin}`;
    const expectedAddress = EXPECTED[key];
    if (!expectedAddress) throw new Error(`Combinação inválida ${data.coin} · ${data.network}.`);

    // ---- 3. Rate limit: max 10 open payments per user ----
    const { count: openCount } = await supabase
      .from("crypto_payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["pending", "verifying", "confirmed"]);
    if ((openCount ?? 0) >= 10) {
      throw new Error("Você tem muitos pagamentos em andamento. Aguarde a verificação antes de enviar outro.");
    }

    // ---- 4. Duplicate check ----
    const { data: dupe } = await supabase
      .from("crypto_payments")
      .select("id, status, user_id")
      .eq("network", data.network)
      .ilike("tx_hash", hash)
      .maybeSingle();
    if (dupe) {
      if (dupe.user_id === userId) throw new Error("Você já enviou este hash. Verifique o status na página.");
      throw new Error("Este hash já foi registrado por outro usuário. Se for seu, envie o comprovante no suporte.");
    }

    // ---- 5. Upload proof to private storage (optional but recommended) ----
    let proofPath: string | null = null;
    if (data.proofBase64 && data.proofMime) {
      const bytes = Uint8Array.from(atob(data.proofBase64), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Comprovante maior que 5MB.");
      const ext = data.proofMime === "image/png" ? "png" : data.proofMime === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("crypto-proofs")
        .upload(path, bytes, { contentType: data.proofMime, upsert: false });
      if (upErr) throw new Error(`Falha ao enviar comprovante: ${upErr.message}`);
      proofPath = path;
    }

    // ---- 6. Insert payment row ----
    const { data: inserted, error: insErr } = await supabase
      .from("crypto_payments")
      .insert({
        user_id: userId,
        plan_slug: plan.slug,
        network: data.network,
        coin: data.coin,
        tx_hash: hash,
        expected_address: expectedAddress,
        proof_path: proofPath,
        amount_brl: Number(plan.price_brl),
        status: "pending",
        required_confirmations: 6,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      // Unique-index race: another submit landed first.
      if (insErr?.code === "23505") throw new Error("Este hash já foi registrado.");
      throw new Error(insErr?.message || "Falha ao registrar pagamento.");
    }

    // ---- 7. Immediate first verification pass (best effort) ----
    try {
      const { verifyOnChain } = await import("./crypto-verify.server");
      const { getBrlPrice, toBrl, decimalsFor } = await import("./crypto-price.server");
      const res = await verifyOnChain(data.network, hash, expectedAddress, data.coin);

      // Convert on-chain amount to BRL for the amount guard.
      let amountCrypto: number | null = null;
      let amountBrlVerified: number | null = null;
      let fxRate: number | null = null;
      if (res.found && res.addressMatches && res.amountSats) {
        const { price } = await getBrlPrice(data.coin);
        const decs = decimalsFor(data.coin, data.network);
        amountCrypto = Number(BigInt(res.amountSats)) / 10 ** decs;
        amountBrlVerified = toBrl(res.amountSats, decs, price);
        fxRate = price;
      }

      let nextStatus: "pending" | "verifying" | "confirmed" | "rejected" = "verifying";
      let failReason: string | null = null;
      let verifiedAt: string | null = null;
      if (!res.found) nextStatus = "pending";
      else if (!res.addressMatches) { nextStatus = "rejected"; failReason = res.reason ?? "endereço de destino não confere"; }
      else if (res.confirmations >= 6) { nextStatus = "confirmed"; verifiedAt = new Date().toISOString(); }

      await supabaseAdmin.from("crypto_payments").update({
        last_checked_at: new Date().toISOString(),
        confirmations: res.confirmations,
        status: nextStatus,
        failure_reason: failReason,
        verified_at: verifiedAt,
        amount_crypto: amountCrypto,
        amount_brl_verified: amountBrlVerified,
        fx_rate_brl: fxRate,
      }).eq("id", inserted.id);

      // If already confirmed on first pass, fulfill immediately (no 90s wait).
      if (nextStatus === "confirmed") {
        const { fulfillCryptoPayment } = await import("./crypto-fulfill.server");
        await fulfillCryptoPayment(inserted.id);
      }
    } catch { /* poller will retry */ }

    return { id: inserted.id };
  });


export const listMyCryptoPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("crypto_payments")
      .select("id, plan_slug, network, coin, tx_hash, status, confirmations, required_confirmations, failure_reason, created_at, verified_at, fulfilled_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { payments: data ?? [] };
  });
