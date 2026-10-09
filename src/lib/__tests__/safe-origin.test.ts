import { afterEach, describe, expect, it, vi } from "vitest";

describe("safeReturnOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aceita o domínio de produção e remove caminho e query", async () => {
    const { safeReturnOrigin } = await import("../safe-origin");
    expect(safeReturnOrigin("https://www.shadowdashstore.com/retorno?x=1")).toBe("https://www.shadowdashstore.com");
  });

  it("rejeita subdomínios Vercel/Lovable que podem pertencer a terceiros", async () => {
    const { safeReturnOrigin, DEFAULT_ORIGIN } = await import("../safe-origin");
    expect(safeReturnOrigin("https://evil-project.vercel.app")).toBe(DEFAULT_ORIGIN);
    expect(safeReturnOrigin("https://fake.lovable.app")).toBe(DEFAULT_ORIGIN);
  });

  it("rejeita esquemas não seguros e URLs com credenciais", async () => {
    const { safeReturnOrigin, DEFAULT_ORIGIN } = await import("../safe-origin");
    expect(safeReturnOrigin("javascript:alert(1)")).toBe(DEFAULT_ORIGIN);
    expect(safeReturnOrigin("https://user:pass@www.shadowdashstore.com")).toBe(DEFAULT_ORIGIN);
  });

  it("aceita o domínio Vercel exato do projeto", async () => {
    const { safeReturnOrigin } = await import("../safe-origin");
    expect(safeReturnOrigin("https://my-little-companion-nu.vercel.app/pagamento")).toBe("https://my-little-companion-nu.vercel.app");
  });
});
