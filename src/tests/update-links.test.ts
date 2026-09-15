import { describe, expect, it } from "vitest";
import { normalizeExternalUrl, externalHostLabel } from "@/lib/update-links";

describe("links externos de atualização", () => {
  it("aceita um link https direto", () => {
    expect(normalizeExternalUrl(" https://cdn.exemplo.com/BTMOB_v4.6.1.rar ")).toBe(
      "https://cdn.exemplo.com/BTMOB_v4.6.1.rar",
    );
  });

  it("converte o link de compartilhamento do Drive em download direto", () => {
    expect(normalizeExternalUrl("https://drive.google.com/file/d/ABC123xyz/view?usp=sharing")).toBe(
      "https://drive.google.com/uc?export=download&id=ABC123xyz",
    );
  });

  it("entende o formato antigo do Drive com id na url", () => {
    expect(normalizeExternalUrl("https://drive.google.com/open?id=ZZZ999")).toBe(
      "https://drive.google.com/uc?export=download&id=ZZZ999",
    );
  });

  it("recusa link sem https", () => {
    expect(() => normalizeExternalUrl("http://cdn.exemplo.com/a.rar")).toThrow(/https/);
  });

  it("recusa texto que não é link", () => {
    expect(() => normalizeExternalUrl("manda pelo whatsapp")).toThrow(/inválido/i);
  });

  it("recusa endereço interno da máquina", () => {
    expect(() => normalizeExternalUrl("https://localhost/a.rar")).toThrow(/acessível/i);
    expect(() => normalizeExternalUrl("https://192.168.0.10/a.rar")).toThrow(/acessível/i);
  });

  it("recusa campo vazio", () => {
    expect(() => normalizeExternalUrl("   ")).toThrow(/Informe o link/);
  });

  it("mostra o nome do site de origem", () => {
    expect(externalHostLabel("https://www.mediafire.com/file/x")).toBe("mediafire.com");
    expect(externalHostLabel(null)).toBeNull();
    expect(externalHostLabel("não é link")).toBeNull();
  });
});
