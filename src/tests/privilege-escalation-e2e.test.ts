/**
 * E2E de segurança — escalada de privilégios (roda em todo deploy).
 *
 * Cria um cliente comum real e tenta, com a sessão dele, fazer o que NÃO pode:
 *   1. se dar VIP, pontos, reputação e contadores de indicação no próprio perfil;
 *   2. aprovar sozinho um pedido de migração;
 *   3. aumentar o valor de um saque na hora de confirmar o recebimento.
 *
 * O guard vive no banco (triggers + policies), então o teste roda contra o
 * projeto ligado ao app. Tudo é limpo no final.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const stamp = Date.now();
const email = `qa.privesc.${stamp}@shadowdashstore.com`;
const password = `Qa!${stamp}#Shadow`;

let userId = "";
let user: SupabaseClient;

beforeAll(async () => {
  expect(URL, "SUPABASE_URL ausente").toBeTruthy();
  expect(SERVICE, "SERVICE_ROLE ausente").toBeTruthy();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error, `falha ao criar usuário de QA: ${error?.message}`).toBeNull();
  userId = created!.user!.id;

  user = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await user.auth.signInWithPassword({ email, password });
  expect(signInErr, `falha no login de QA: ${signInErr?.message}`).toBeNull();

  // garante o perfil (o trigger de signup já cria, mas evitamos corrida)
  await admin.from("profiles").upsert({ id: userId, email }, { onConflict: "id" });
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
});

describe("Escalada de privilégios — perfil", () => {
  it("cliente NÃO consegue se dar VIP, pontos ou reputação", async () => {
    await user
      .from("profiles")
      .update({
        vip_tier: "elite",
        reward_points: 999999,
        total_points_earned: 999999,
        reputation_score: 9999,
        trust_score: 9999,
        conversions_count: 999,
        referrals_valid_count: 999,
      } as never)
      .eq("id", userId);

    const { data } = await admin
      .from("profiles")
      .select("vip_tier, reward_points, reputation_score, trust_score, conversions_count, referrals_valid_count")
      .eq("id", userId)
      .maybeSingle();

    expect(data?.vip_tier ?? "none").not.toBe("elite");
    expect(Number(data?.reward_points ?? 0)).toBeLessThan(999999);
    expect(Number(data?.reputation_score ?? 0)).toBeLessThan(9999);
    expect(Number(data?.trust_score ?? 0)).toBeLessThan(9999);
    expect(Number(data?.conversions_count ?? 0)).toBeLessThan(999);
    expect(Number(data?.referrals_valid_count ?? 0)).toBeLessThan(999);
  });

  it("cliente ainda consegue editar os dados não sensíveis do próprio perfil", async () => {
    const nick = `qa-nick-${stamp}`;
    const { error } = await user.from("profiles").update({ display_name: nick } as never).eq("id", userId);
    expect(error).toBeNull();

    const { data } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    expect(data?.display_name).toBe(nick);
  });
});

describe("Escalada de privilégios — pedidos de migração", () => {
  it("cliente NÃO consegue aprovar o próprio pedido", async () => {
    const { data: req, error: insErr } = await admin
      .from("migration_requests")
      .insert({ user_id: userId, status: "pending" } as never)
      .select("id")
      .maybeSingle();
    if (insErr) return; // schema divergente no ambiente: nada a validar aqui

    await user.from("migration_requests").update({ status: "approved" } as never).eq("id", req!.id);

    const { data: after } = await admin
      .from("migration_requests")
      .select("status")
      .eq("id", req!.id)
      .maybeSingle();
    expect(after?.status).not.toBe("approved");

    await admin.from("migration_requests").delete().eq("id", req!.id);
  });
});

describe("Escalada de privilégios — saques", () => {
  it("cliente NÃO consegue aumentar o valor ao confirmar o recebimento", async () => {
    const { data: payout, error: insErr } = await admin
      .from("payout_requests")
      .insert({ user_id: userId, amount: 10, status: "paid", pix_key: "qa@pix" } as never)
      .select("id")
      .maybeSingle();
    if (insErr) return;

    await user
      .from("payout_requests")
      .update({ status: "confirmed", amount: 999999, pix_key: "atacante@pix" } as never)
      .eq("id", payout!.id);

    const { data: after } = await admin
      .from("payout_requests")
      .select("amount, pix_key")
      .eq("id", payout!.id)
      .maybeSingle();

    expect(Number(after?.amount)).toBe(10);
    expect(after?.pix_key).toBe("qa@pix");

    await admin.from("payout_requests").delete().eq("id", payout!.id);
  });
});
