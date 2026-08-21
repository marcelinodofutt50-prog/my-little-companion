import { describe, it, expect } from "vitest";
import { isChunkLoadError } from "@/components/ErrorBoundary";

describe("recuperação de módulos após deploy", () => {
  it("reconhece as mensagens de falha de import dos navegadores", () => {
    const samples = [
      new TypeError("Importing a module script failed."),
      new TypeError("Failed to fetch dynamically imported module: https://site/build-chunk-x.js"),
      new Error("error loading dynamically imported module"),
      Object.assign(new Error("boom"), { name: "ChunkLoadError" }),
      new Error("Unable to preload CSS for /build-chunk-panel.css"),
    ];
    for (const s of samples) expect(isChunkLoadError(s)).toBe(true);
  });

  it("não confunde erros normais da aplicação com falha de deploy", () => {
    expect(isChunkLoadError(new Error("Could not find the table 'public.redeem_codes'"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
