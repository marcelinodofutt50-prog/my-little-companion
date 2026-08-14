import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Testes do motor antifraude multicamadas.
 * O Supabase é substituído por um duplo controlado por tabela, então cada
 * cenário descreve exatamente o "mundo" que o motor enxerga.
 */

process.env.IP_HASH_SALT = "salt-de-teste-suficientemente-grande";

let headers: Record<string, string> = { "cf-connecting-ip": "200.10.20.30", "user-agent": "TestUA" };
let world: Record<string, any[]> = {};
const inserted: Array<{ table: string; row: any }> = [];

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => headers[name] ?? undefined,
}));

function builder(table: string) {
  let rows = [...(world[table] ?? [])];
  const api: any = {
    select: () => api,
    eq: (col: string, val: any) => { rows = rows.filter((r) => r[col] === val); return api; },
    neq: (col: string, val: any) => { rows = rows.filter((r) => r[col] !== val); return api; },
    gt: () => api,
    gte: () => api,
    in: (col: string, vals: any[]) => { rows = rows.filter((r) => vals.includes(r[col])); return api; },
    not: () => api,
    or: (expr: string) => {
      const clauses = expr.split(",").map((c) => c.split("."));
      rows = rows.filter((r) => clauses.some(([col, , val]) => r[col!] === val));
      return api;
    },
    order: () => api,
    limit: () => api,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    insert: async (row: any) => { inserted.push({ table, row }); return { data: null, error: null }; },
    update: () => ({ eq: async () => ({ data: null, error: null }) }),
    then: (resolve: any) => resolve({ data: rows, error: null, count: rows.length }),
  };
  return api;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => builder(table) },
}));

const NEW_USER = "11111111-1111-1111-1111-111111111111";
const OTHER_USER = "22222222-2222-2222-2222-222222222222";

async function assess(action: "trial" | "play_protect", device: any, userId = NEW_USER) {
  const { assessAbuse } = await import("../fraud-engine.server");
  return assessAbuse({ userId, action, device });
}

beforeEach(() => {
  inserted.length = 0;
  headers = { "cf-connecting-ip": "200.10.20.30", "user-agent": "TestUA" };
  world = {
    profiles: [{ id: NEW_USER, email: "cliente.novo@gmail.com", email_canonical: "clientenovo@gmail.com", created_at: new Date().toISOString() }],
    trials: [],
    apk_free_trials: [],
    device_identities: [],
    antifraud_allowlist: [],
    fraud_assessments: [],
  };
});

const device = { deviceId: "device-abc-12345678", attrs: "1920x1080x24|2|America/Sao_Paulo|pt-BR|Linux|8|8|0|Mozilla" };

describe("fraud engine", () => {
  it("libera cliente novo e legítimo (score zero)", async () => {
    const v = await assess("trial", device);
    expect(v.allowed).toBe(true);
    expect(v.score).toBe(0);
    expect(v.deviceHash).toBeTruthy();
  });

  it("nega quando o mesmo aparelho já resgatou o teste em outra conta", async () => {
    const first = await assess("trial", device);
    world.trials = [{ user_id: OTHER_USER, device_hash: first.deviceHash, ip_hash: first.ipHash }];
    const v = await assess("trial", device);
    expect(v.allowed).toBe(false);
    expect(v.reasons).toContain("device_already_used");
  });

  it("nega quando outra conta do mesmo Gmail (pontos/+alias) já usou", async () => {
    world.profiles.push({ id: OTHER_USER, email: "cliente.novo+2@gmail.com", email_canonical: "clientenovo@gmail.com", created_at: new Date().toISOString() });
    world.trials = [{ user_id: OTHER_USER }];
    const v = await assess("trial", { deviceId: "outro-aparelho-999", attrs: device.attrs });
    expect(v.allowed).toBe(false);
    expect(v.reasons).toContain("same_inbox_already_used");
  });

  it("nega e-mail descartável", async () => {
    world.profiles = [{ id: NEW_USER, email: "abc@mailinator.com", email_canonical: null, created_at: new Date().toISOString() }];
    const v = await assess("trial", device);
    expect(v.allowed).toBe(false);
    expect(v.reasons).toContain("disposable_email");
  });

  it("nega quando o aparelho é conhecido de outra conta que já consumiu", async () => {
    const probe = await assess("play_protect", device);
    world.device_identities = [{ user_id: OTHER_USER, device_hash: probe.deviceHash, attrs_hash: probe.attrsHash, ip_prefix_hash: probe.ipPrefixHash }];
    world.apk_free_trials = [{ user_id: OTHER_USER }];
    const v = await assess("play_protect", device);
    expect(v.allowed).toBe(false);
  });

  it("IP repetido sozinho NÃO barra cliente real (operadora/NAT)", async () => {
    const probe = await assess("trial", device);
    world.trials = [{ user_id: OTHER_USER, ip_hash: probe.ipHash, device_hash: "outro-hash" }];
    const v = await assess("trial", device);
    expect(v.allowed).toBe(true);
    expect(v.reasons.join(",")).toContain("ip_reuse");
  });

  it("mesmo hardware + mesma rede + IP repetido soma e barra a fraude", async () => {
    const probe = await assess("trial", device);
    world.trials = [{ user_id: OTHER_USER, ip_hash: probe.ipHash, device_hash: "hash-antigo" }];
    world.device_identities = [
      { user_id: OTHER_USER, device_hash: "hash-antigo", attrs_hash: probe.attrsHash, ip_prefix_hash: probe.ipPrefixHash },
    ];
    const v = await assess("trial", { deviceId: "storage-limpo-99999", attrs: device.attrs });
    expect(v.score).toBeGreaterThanOrEqual(60);
    expect(v.allowed).toBe(false);
  });

  it("registra o aparelho e grava a auditoria da decisão", async () => {
    await assess("trial", device);
    expect(inserted.some((i) => i.table === "device_identities")).toBe(true);
    expect(inserted.some((i) => i.table === "fraud_assessments")).toBe(true);
  });

  it("faixa de rede é calculada por /24 (IPv4) e /48 (IPv6)", async () => {
    const { ipPrefix } = await import("../fraud-engine.server");
    expect(ipPrefix("187.45.9.211")).toBe("187.45.9.0/24");
    expect(ipPrefix("2804:14d:1:2:3:4:5:6")).toBe("2804:14d:1::/48");
    expect(ipPrefix("nao-e-ip")).toBeNull();
  });
});
