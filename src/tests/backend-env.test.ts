import { describe, it, expect, beforeEach, vi } from "vitest";

const NEW = "https://lsnkrdprzdijinstozhv.supabase.co";
const OLD = "https://dvnksmqbpbzwgwmbnjjy.supabase.co";

async function load() {
  vi.resetModules();
  return await import("../lib/backend-env.server");
}

describe("alignServerBackendEnv", () => {
  beforeEach(() => {
    for (const k of [
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "FILES_SUPABASE_URL",
      "FILES_SUPABASE_PUBLISHABLE_KEY",
      "FILES_SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      delete process.env[k];
    }
  });

  it("não altera nada quando servidor e navegador já batem", async () => {
    process.env["VITE_SUPABASE_URL"] = NEW;
    process.env["SUPABASE_URL"] = NEW;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_ok";
    const { alignServerBackendEnv } = await load();
    alignServerBackendEnv();
    expect(process.env["SUPABASE_URL"]).toBe(NEW);
    expect(process.env["SUPABASE_SERVICE_ROLE_KEY"]).toBe("sb_secret_ok");
  });

  it("realinha o servidor quando ele aponta para o projeto antigo", async () => {
    process.env["VITE_SUPABASE_URL"] = NEW;
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_new";
    process.env["SUPABASE_URL"] = OLD;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_old";
    process.env["FILES_SUPABASE_URL"] = NEW;
    process.env["FILES_SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_new";
    const { alignServerBackendEnv } = await load();
    alignServerBackendEnv();
    expect(process.env["SUPABASE_URL"]).toBe(NEW);
    expect(process.env["SUPABASE_SERVICE_ROLE_KEY"]).toBe("sb_secret_new");
    expect(process.env["SUPABASE_PUBLISHABLE_KEY"]).toBe("sb_publishable_new");
    expect(process.env["SUPABASE_PROJECT_ID"]).toBe("lsnkrdprzdijinstozhv");
  });

  it("preenche a chave de serviço ausente mesmo com a URL certa", async () => {
    process.env["VITE_SUPABASE_URL"] = NEW;
    process.env["SUPABASE_URL"] = NEW;
    process.env["FILES_SUPABASE_URL"] = NEW;
    process.env["FILES_SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_new";
    const { alignServerBackendEnv } = await load();
    alignServerBackendEnv();
    expect(process.env["SUPABASE_SERVICE_ROLE_KEY"]).toBe("sb_secret_new");
  });

  it("não usa credenciais de outro projeto", async () => {
    process.env["VITE_SUPABASE_URL"] = NEW;
    process.env["SUPABASE_URL"] = OLD;
    process.env["FILES_SUPABASE_URL"] = "https://outro.supabase.co";
    process.env["FILES_SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_outro";
    const { alignServerBackendEnv } = await load();
    alignServerBackendEnv();
    expect(process.env["SUPABASE_URL"]).toBe(OLD);
    expect(process.env["SUPABASE_SERVICE_ROLE_KEY"]).toBeUndefined();
  });
});
