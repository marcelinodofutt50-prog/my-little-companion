/**
 * Verificação automática pós-login (roda em todo deploy).
 *
 * Simula um cliente real autenticado no banco de PRODUÇÃO (o mesmo da Vercel) e
 * garante que, depois do login — e também depois de um "refresh" do browser
 * (sessão restaurada a partir do refresh token) —:
 *   1. a licença aparece corretamente no painel;
 *   2. o Centro de Treinamento carrega (tabelas + bucket + progresso);
 *   3. o Staff Nexus carrega para staff e nega quem não é staff.
 *
 * Tudo é feito com um usuário efêmero, criado e removido pelo próprio teste.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.EXT_SUPABASE_URL || process.env.SUPABASE_URL!;
const ANON = process.env.EXT_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const stamp = Date.now();
const email = `qa.postlogin.${stamp}@shadowdashstore.com`;
const password = `Qa!${stamp}#Shadow`;

let userId = "";
let licenseId = "";
let user: SupabaseClient;
let refreshToken = "";

/** Cliente "novo" a partir do refresh token = o que acontece após F5 no browser. */
async function clientAfterRefresh() {
  const fresh = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await fresh.auth.refreshSession({ refresh_token: refreshToken });
  expect(error, `refresh de sessão falhou: ${error?.message}`).toBeNull();
  expect(data.session?.access_token).toBeTruthy();
  if (data.session?.refresh_token) refreshToken = data.session.refresh_token;
  return fresh;
}

beforeAll(async () => {
  expect(URL, "SUPABASE_URL ausente").toBeTruthy();
  expect(SERVICE, "SERVICE_ROLE ausente").toBeTruthy();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(createErr, `não foi possível criar o usuário de QA: ${createErr?.message}`).toBeNull();
  userId = created!.user!.id;

  // Licença paga ativa que DEVE aparecer no painel do cliente.
  const { data: lic, error: licErr } = await admin
    .from("licenses")
    .insert({
      user_id: userId,
      is_trial: false,
      revoked: false,
      plan_slug: "monthly_457",
      yaarsa_email: email,
      yaarsa_username: `qa${stamp}`,
      yaarsa_password: `qa${stamp}`,
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    })
    .select("id")
    .single();
  expect(licErr, `não foi possível criar a licença de QA: ${licErr?.message}`).toBeNull();
  licenseId = lic!.id;

  user = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: session, error: signErr } = await user.auth.signInWithPassword({ email, password });
  expect(signErr, `login falhou: ${signErr?.message}`).toBeNull();
  refreshToken = session!.session!.refresh_token;
}, 60_000);

afterAll(async () => {
  if (licenseId) await admin.from("licenses").delete().eq("id", licenseId);
  if (userId) {
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("staff_messages").delete().eq("sender_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
});

describe("Pós-login — licença no painel", () => {
  it("a licença do cliente aparece logo após o login", async () => {
    const { data, error } = await user
      .from("licenses")
      .select("id, plan_slug, revoked, disabled_at, expires_at, is_trial")
      .eq("user_id", userId);
    expect(error, error?.message).toBeNull();
    expect(data?.map((l) => l.id)).toContain(licenseId);
    expect(data![0]!.revoked).toBe(false);
  });

  it("a licença continua visível depois do refresh do browser", async () => {
    const fresh = await clientAfterRefresh();
    const { data, error } = await fresh.from("licenses").select("id").eq("user_id", userId);
    expect(error, error?.message).toBeNull();
    expect(data?.map((l) => l.id)).toContain(licenseId);
  });

  it("o cliente não enxerga licenças de outras pessoas", async () => {
    const { data } = await user.from("licenses").select("id, user_id").neq("user_id", userId).limit(5);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("Pós-login — Centro de Treinamento", () => {
  it("as tabelas do Centro de Treinamento respondem (sem PGRST205)", async () => {
    const tutorials = await user.from("tutorials").select("id, title").limit(5);
    expect(tutorials.error?.code, tutorials.error?.message).not.toBe("PGRST205");
    const progress = await user.from("tutorial_progress").select("tutorial_id").eq("user_id", userId);
    expect(progress.error, progress.error?.message).toBeNull();
  });

  it("o cliente consegue gravar e reler o próprio progresso", async () => {
    const { data: anyTutorial } = await admin.from("tutorials").select("id").limit(1).maybeSingle();
    if (!anyTutorial) return; // sem conteúdo publicado ainda
    const up = await user
      .from("tutorial_progress")
      .upsert({ user_id: userId, tutorial_id: anyTutorial.id, completed: true }, { onConflict: "user_id,tutorial_id" });
    expect(up.error, up.error?.message).toBeNull();

    const fresh = await clientAfterRefresh();
    const { data, error } = await fresh
      .from("tutorial_progress")
      .select("tutorial_id, completed")
      .eq("user_id", userId);
    expect(error, error?.message).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  it("o bucket de vídeos existe e emite link assinado", async () => {
    const { data: buckets } = await admin.storage.listBuckets();
    expect(buckets?.map((b) => b.name)).toContain("tutorials");
    const path = `qa/postlogin-${stamp}.txt`;
    const upload = await admin.storage.from("tutorials").upload(path, new Blob(["qa"]), { upsert: true });
    expect(upload.error, upload.error?.message).toBeNull();
    const signed = await admin.storage.from("tutorials").createSignedUrl(path, 60);
    expect(signed.error, signed.error?.message).toBeNull();
    expect(signed.data?.signedUrl).toContain("token=");
    await admin.storage.from("tutorials").remove([path]);
  });
});

describe("Pós-login — Staff Nexus", () => {
  it("nega o canal interno para quem não é staff", async () => {
    const { data, error } = await user.from("staff_messages").select("id").limit(1);
    expect(!!error || (data ?? []).length === 0).toBe(true);
    const insert = await user.from("staff_messages").insert({ sender_id: userId, content: "qa", channel: "general" });
    expect(insert.error).not.toBeNull();
  });

  it("libera o canal interno quando a conta tem cargo de suporte, inclusive após refresh", async () => {
    const grant = await admin.from("user_roles").insert({ user_id: userId, role: "support" });
    expect(grant.error, grant.error?.message).toBeNull();

    const staff = await clientAfterRefresh();
    const read = await staff.from("staff_messages").select("id, channel").limit(5);
    expect(read.error, read.error?.message).toBeNull();

    const sent = await staff
      .from("staff_messages")
      .insert({ sender_id: userId, content: `qa-postlogin-${stamp}`, channel: "general" })
      .select("id")
      .maybeSingle();
    expect(sent.error, sent.error?.message).toBeNull();
    if (sent.data?.id) await admin.from("staff_messages").delete().eq("id", sent.data.id);
  });

  it("staff não consegue publicar se passando por outro usuário", async () => {
    const staff = await clientAfterRefresh();
    const spoof = await staff
      .from("staff_messages")
      .insert({ sender_id: "00000000-0000-0000-0000-000000000000", content: "spoof", channel: "general" });
    expect(spoof.error).not.toBeNull();
  });
});
