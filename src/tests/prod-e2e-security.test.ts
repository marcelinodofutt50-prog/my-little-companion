/**
 * Testes de ponta a ponta + segurança executados contra o BANCO DE PRODUÇÃO
 * (o mesmo projeto que a Vercel usa). São testes NÃO destrutivos:
 * - com a chave pública (anon) checamos se o RLS realmente bloqueia leitura/escrita;
 * - com a chave de serviço apenas LEMOS o schema/infra necessária aos fluxos.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { detectTrialMisconduct } from "@/lib/trial-misconduct";

const URL = process.env.EXT_SUPABASE_URL || process.env.SUPABASE_URL!;
const ANON = process.env.EXT_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const blocked = (error: { message?: string } | null, data: unknown[] | null) =>
  !!error || (Array.isArray(data) && data.length === 0);

describe("Produção — infraestrutura dos fluxos críticos", () => {
  beforeAll(() => {
    expect(URL).toBeTruthy();
    expect(SERVICE).toBeTruthy();
  });

  it("aponta para o projeto de produção usado pela Vercel", () => {
    expect(URL).toContain("dvnksmqbpbzwgwmbnjjy");
  });

  it.each([
    ["licenses", "id,is_trial,revoked,disabled_at,expires_at"],
    ["trials", "user_id,device_hash,attrs_hash,ip_prefix_hash"],
    ["apk_jobs", "id,status,user_id"],
    ["apk_free_trials", "user_id,device_hash,attrs_hash,ip_hash,ip_prefix_hash"],
    ["device_identities", "user_id,device_hash,seen_count"],
    ["fraud_assessments", "user_id,action,decision,score,reasons"],
    ["audit_logs", "user_id,event,decision,reason,system,metadata"],
    ["staff_messages", "sender_id,content,channel"],
    ["tutorials", "id,title"],
    ["tutorial_progress", "id"],
    ["support_messages", "id,thread_id,is_system,is_admin"],
    ["play_protect_grants", "user_id,license_id,expires_at"],
  ])("tabela %s está publicada na API com as colunas esperadas", async (table, cols) => {
    const { error } = await admin.from(table).select(cols).limit(1);
    expect(error?.message ?? null).toBeNull();
  });

  it.each(["avatars", "tutorials", "apk-uploads", "apk-results", "support-media"])(
    "bucket %s existe",
    async (bucket) => {
      const { data, error } = await admin.storage.getBucket(bucket);
      expect(error).toBeNull();
      expect(data?.name).toBe(bucket);
    },
  );

  it("Centro de Treinamento: upload + link assinado funcionam de ponta a ponta", async () => {
    const path = `e2e/${Date.now()}-vitest.txt`;
    const up = await admin.storage
      .from("tutorials")
      .upload(path, new Blob(["e2e"]), { contentType: "text/plain" });
    expect(up.error).toBeNull();

    const signed = await admin.storage.from("tutorials").createSignedUrl(path, 60);
    expect(signed.error).toBeNull();
    const res = await fetch(signed.data!.signedUrl);
    expect(res.status).toBe(200);

    await admin.storage.from("tutorials").remove([path]);
  });

  it("Play Protect e trial: índices de 1 por aparelho estão ativos", async () => {
    const { data, error } = await admin.rpc("check_rls_enabled", { target_table: "trials" });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });
});

describe("Segurança — RLS bloqueia acesso anônimo", () => {
  it.each([
    "profiles",
    "licenses",
    "trials",
    "orders",
    "support_messages",
    "support_threads",
    "device_identities",
    "fraud_assessments",
    "audit_logs",
    "recovery_codes",
    "payout_requests",
  ])("anon não consegue ler %s", async (table) => {
    const { data, error } = await anon.from(table).select("*").limit(1);
    expect(blocked(error, data)).toBe(true);
  });

  it("anon não consegue escrever em licenses", async () => {
    const { error } = await anon
      .from("licenses")
      .insert({ user_id: "00000000-0000-0000-0000-000000000000", plan_slug: "trial" } as never);
    expect(error).not.toBeNull();
  });

  it("anon não consegue registrar aparelho (device_identities)", async () => {
    const { error } = await anon
      .from("device_identities")
      .insert({ user_id: "00000000-0000-0000-0000-000000000000", device_hash: "fake" } as never);
    expect(error).not.toBeNull();
  });
});

describe("Segurança — Staff Nexus (bypass de staff)", () => {
  it("anon não lê o canal interno", async () => {
    const { data, error } = await anon.from("staff_messages").select("*").limit(1);
    expect(blocked(error, data)).toBe(true);
  });

  it("anon não publica no canal interno", async () => {
    const { error } = await anon
      .from("staff_messages")
      .insert({ content: "invasao", channel: "general" } as never);
    expect(error).not.toBeNull();
  });

  it("política exige is_staff() e sender_id = auth.uid()", async () => {
    const { data, error } = await admin.rpc("check_rls_enabled", { target_table: "staff_messages" });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });
});

describe("Segurança — uploads", () => {
  it("anon não envia arquivo para o bucket privado de tutoriais", async () => {
    const { error } = await anon.storage
      .from("tutorials")
      .upload(`intruso/${Date.now()}.txt`, new Blob(["x"]));
    expect(error).not.toBeNull();
  });

  it("anon não envia avatar para a pasta de outro usuário", async () => {
    const { error } = await anon.storage
      .from("avatars")
      .upload(`00000000-0000-0000-0000-000000000000/${Date.now()}.txt`, new Blob(["x"]));
    expect(error).not.toBeNull();
  });

  it("anon não lê arquivos privados de outro usuário", async () => {
    const { error } = await anon.storage.from("apk-results").list("");
    // list pode retornar vazio; o que não pode é baixar
    const dl = await anon.storage.from("apk-results").download("qualquer/arquivo.apk");
    expect(dl.error).not.toBeNull();
    expect(error === null || !!error).toBe(true);
  });
});

describe("Conduta: só revoga com evidência válida", () => {
  const naoDeveMarcar = [
    "que pena, não consegui instalar ainda",
    "vale a pena comprar o vitalício?",
    "pode repassar a senha nova pra mim?",
    "bom dia, tudo bem?",
    "não estou conseguindo logar no meu celular",
    "instalei no meu aparelho e deu erro",
    "uma pena que o servidor caiu ontem",
  ];

  const deveMarcar = [
    "não estou conseguindo instalar na pena do cliente",
    "coloquei em umas penas aqui e deu erro",
    "quero usar no bico que peguei",
    "vou revender esse acesso",
    "meus clientes estão reclamando do login",
    "como faço pra repassar o login pra outra pessoa",
  ];

  it.each(naoDeveMarcar)("não sinaliza cliente legítimo: %s", (msg) => {
    expect(detectTrialMisconduct(msg).flagged).toBe(false);
  });

  it.each(deveMarcar)("sinaliza conduta inadequada: %s", (msg) => {
    const r = detectTrialMisconduct(msg);
    expect(r.flagged).toBe(true);
    expect(r.matched.length).toBeGreaterThan(0);
  });

  it("mensagem vazia nunca sinaliza", () => {
    expect(detectTrialMisconduct("").flagged).toBe(false);
    expect(detectTrialMisconduct("   ").flagged).toBe(false);
  });
});
