import { describe, expect, it } from "vitest";
import {
  grantPartnerEntitlement,
  grantPartnerEntitlementFromCode,
  isEntitlementActive,
  PARTNER_PLANS,
  partnerKindFromSlug,
} from "@/lib/partner.server";

/** Stub mínimo do supabaseAdmin usado pelo fulfillment de parceria. */
function makeAdmin(seed: { entitlements?: any[]; requests?: any[] } = {}) {
  const state = {
    entitlements: seed.entitlements ?? ([] as any[]),
    requests: seed.requests ?? ([] as any[]),
  };

  function table(name: "partner_entitlements" | "partner_service_requests") {
    const rows = () => (name === "partner_entitlements" ? state.entitlements : state.requests);
    const filters: Array<(r: any) => boolean> = [];
    const api: any = {
      select: () => api,
      eq: (col: string, val: any) => { filters.push((r) => r[col] === val); return api; },
      in: (col: string, vals: any[]) => { filters.push((r) => vals.includes(r[col])); return api; },
      contains: (col: string, value: any) => {
        filters.push((r) => Object.entries(value).every(([k, v]) => r[col]?.[k] === v));
        return api;
      },
      order: () => api,
      limit: () => api,
      maybeSingle: async () => ({ data: rows().filter((r) => filters.every((f) => f(r)))[0] ?? null }),
      single: async () => ({ data: rows().filter((r) => filters.every((f) => f(r)))[0] ?? null }),
      then: undefined,
      insert: (payload: any) => {
        const row = { id: `id-${rows().length + 1}`, created_at: new Date().toISOString(), ...payload };
        rows().push(row);
        const ins: any = {
          select: () => ins,
          single: async () => ({ data: row, error: null }),
          maybeSingle: async () => ({ data: row, error: null }),
        };
        return ins;
      },
      update: (patch: any) => {
        const upd: any = {
          eq: (col: string, val: any) => {
            rows().forEach((r) => { if (r[col] === val) Object.assign(r, patch); });
            return Promise.resolve({ error: null });
          },
        };
        return upd;
      },
    };
    // Suporta `await admin.from(x).select(...).eq(...)` sem maybeSingle.
    api.then = (resolve: any) => resolve({ data: rows().filter((r) => filters.every((f) => f(r))), error: null });
    return api;
  }

  return { from: (name: any) => table(name), state };
}

describe("produtos de parceria", () => {
  it("mapeia cada plano para o tipo de acesso certo", () => {
    expect(partnerKindFromSlug("partner-reseller-60d")).toBe("reseller");
    expect(partnerKindFromSlug("server-deploy-basic")).toBe("deploy");
    expect(partnerKindFromSlug("server-deploy-managed")).toBe("deploy");
    expect(partnerKindFromSlug("server-managed-monthly")).toBe("managed");
    expect(partnerKindFromSlug("login-30d")).toBeNull();
  });

  it("cobra a revenda a cada 60 dias e a gestão a cada 30", () => {
    expect(PARTNER_PLANS["partner-reseller-60d"].days).toBe(60);
    expect(PARTNER_PLANS["server-managed-monthly"].days).toBe(30);
    expect(PARTNER_PLANS["server-deploy-basic"].days).toBeNull();
  });

  it("libera a revenda ativa por 60 dias no pagamento", async () => {
    const admin = makeAdmin();
    const res = await grantPartnerEntitlement(admin, {
      userId: "u1", orderId: "o1", planSlug: "partner-reseller-60d",
    });
    expect(res.ok).toBe(true);
    expect(res.kind).toBe("reseller");
    const ent = admin.state.entitlements[0];
    expect(ent.status).toBe("active");
    const days = Math.round((new Date(ent.expires_at).getTime() - Date.now()) / 86400000);
    expect(days).toBe(60);
  });

  it("não duplica acesso quando o webhook chega duas vezes", async () => {
    const admin = makeAdmin();
    await grantPartnerEntitlement(admin, { userId: "u1", orderId: "o1", planSlug: "partner-reseller-60d" });
    await grantPartnerEntitlement(admin, { userId: "u1", orderId: "o1", planSlug: "partner-reseller-60d" });
    expect(admin.state.entitlements).toHaveLength(1);
  });

  it("renova somando tempo em vez de criar um segundo acesso", async () => {
    const admin = makeAdmin();
    await grantPartnerEntitlement(admin, { userId: "u1", orderId: "o1", planSlug: "server-managed-monthly" });
    await grantPartnerEntitlement(admin, { userId: "u1", orderId: "o2", planSlug: "server-managed-monthly" });
    expect(admin.state.entitlements).toHaveLength(1);
    const days = Math.round((new Date(admin.state.entitlements[0].expires_at).getTime() - Date.now()) / 86400000);
    expect(days).toBe(60);
  });

  it("abre chamado automático para o serviço de instalação", async () => {
    const admin = makeAdmin();
    const res = await grantPartnerEntitlement(admin, { userId: "u2", orderId: "o9", planSlug: "server-deploy-managed" });
    expect(res.kind).toBe("deploy");
    expect(admin.state.entitlements[0].status).toBe("pending_setup");
    expect(admin.state.entitlements[0].expires_at).toBeNull();
    expect(admin.state.requests).toHaveLength(1);
    expect(admin.state.requests[0].status).toBe("open");
  });

  it("recusa plano que não é de parceria", async () => {
    const admin = makeAdmin();
    const res = await grantPartnerEntitlement(admin, { userId: "u1", orderId: "o3", planSlug: "login-30d" });
    expect(res.ok).toBe(false);
  });

  it("libera revenda por código e não aplica o mesmo resgate duas vezes", async () => {
    const admin = makeAdmin();
    const input = {
      userId: "u1",
      planSlug: "partner-reseller-60d",
      claimId: "claim-1",
    };
    const first = await grantPartnerEntitlementFromCode(admin, input);
    const second = await grantPartnerEntitlementFromCode(admin, input);
    expect(first.ok).toBe(true);
    expect(first.kind).toBe("reseller");
    expect(second.entitlementId).toBe(first.entitlementId);
    expect(admin.state.entitlements).toHaveLength(1);
    expect(admin.state.entitlements[0].metadata.redeem_claim_id).toBe("claim-1");
  });

  it("código de instalação abre um único atendimento", async () => {
    const admin = makeAdmin();
    const input = {
      userId: "u2",
      planSlug: "server-deploy-basic",
      claimId: "claim-2",
    };
    await grantPartnerEntitlementFromCode(admin, input);
    await grantPartnerEntitlementFromCode(admin, input);
    expect(admin.state.entitlements).toHaveLength(1);
    expect(admin.state.requests).toHaveLength(1);
    expect(admin.state.requests[0].status).toBe("open");
  });

  it("considera vencido quando a data passou", () => {
    expect(isEntitlementActive({ status: "active", expires_at: "2000-01-01T00:00:00Z" })).toBe(false);
    expect(isEntitlementActive({ status: "active", expires_at: null })).toBe(true);
    expect(isEntitlementActive({ status: "pending_setup", expires_at: null })).toBe(true);
    expect(isEntitlementActive({ status: "cancelled", expires_at: null })).toBe(false);
  });
});
