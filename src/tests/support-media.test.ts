import { describe, expect, it } from "vitest";
import {
  extractSupportMediaPath,
  mediaFileName,
  mediaKind,
  safeMediaFileName,
  formatBytes,
} from "@/lib/support-media";

describe("mídia do chat de suporte", () => {
  it("extrai o caminho do arquivo de um link assinado vencido", () => {
    const url =
      "https://x.supabase.co/storage/v1/object/sign/support-media/user-1/thread-2/1700000000-print.png?token=abc.def";
    expect(extractSupportMediaPath(url)).toBe("user-1/thread-2/1700000000-print.png");
  });

  it("decodifica caminho com caracteres escapados", () => {
    const url = "https://x/storage/v1/object/sign/support-media/u/t/nota%20fiscal.pdf?token=1";
    expect(extractSupportMediaPath(url)).toBe("u/t/nota fiscal.pdf");
  });

  it("ignora link fora do bucket", () => {
    expect(extractSupportMediaPath("https://exemplo.com/imagem.png")).toBeNull();
    expect(extractSupportMediaPath(null)).toBeNull();
  });

  it("gera nome de arquivo seguro para o storage", () => {
    expect(safeMediaFileName("Comprovante Pix (final).PNG")).toBe("Comprovante-Pix-final.png");
    expect(safeMediaFileName("erro à noite.jpg")).toBe("erro-a-noite.jpg");
    expect(safeMediaFileName("###.png")).toBe("arquivo.png");
  });

  it("detecta o tipo de mídia por MIME e por extensão", () => {
    expect(mediaKind("image/png")).toBe("image");
    expect(mediaKind("video/mp4")).toBe("video");
    expect(mediaKind("audio/ogg")).toBe("audio");
    expect(mediaKind("application/pdf")).toBe("pdf");
    expect(mediaKind(null, "https://x/storage/v1/object/sign/support-media/u/t/v.MP4?token=1")).toBe("video");
    expect(mediaKind(null, "https://x/storage/v1/object/sign/support-media/u/t/doc.bin?token=1")).toBe("file");
  });

  it("mostra o nome do anexo sem o carimbo de tempo", () => {
    expect(mediaFileName("https://x/storage/v1/object/sign/support-media/u/t/1700000000-print.png?token=1")).toBe(
      "print.png",
    );
  });

  it("formata tamanho de arquivo", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
  });
});
