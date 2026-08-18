import { describe, it, expect } from "vitest";
import fs from "fs";
import { extractTutorialPath } from "@/lib/tutorial-media";

describe("Reprodução de tutoriais", () => {
  it("extrai o caminho de URLs públicas e assinadas do bucket privado", () => {
    expect(
      extractTutorialPath("https://x.supabase.co/storage/v1/object/public/tutorials/videos/a%20b.mp4"),
    ).toBe("videos/a b.mp4");
    expect(
      extractTutorialPath("https://x.supabase.co/storage/v1/object/sign/tutorials/videos/a.mp4?token=xyz"),
    ).toBe("videos/a.mp4");
    expect(extractTutorialPath("https://youtu.be/abc")).toBeNull();
  });

  it("o resolvedor assina a mídia no servidor (bucket privado)", () => {
    const src = fs.readFileSync("src/lib/tutorial-media.ts", "utf8");
    expect(src).toContain("signTutorialMedia");
  });

  it("a assinatura pública só é emitida para tutoriais ativos", () => {
    const src = fs.readFileSync("src/lib/public-tutorials.functions.ts", "utf8");
    expect(src).toContain("signTutorialMedia");
    expect(src).toContain('.eq("is_active", true)');
  });

  it("a página pública do tutorial usa a URL resolvida, não a URL crua", () => {
    const src = fs.readFileSync("src/routes/tutorial.$id.tsx", "utf8");
    expect(src).toContain("useTutorialMedia");
    expect(src).not.toContain("src={tutorial.video_url");
  });
});

describe("Cron de licenças", () => {
  it("o cron diário aciona todas as rotinas de manutenção", () => {
    const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
    const paths = (vercel.crons ?? []).map((c: { path: string }) => c.path);
    expect(paths).toContain("/api/public/hooks/daily-maintenance");

    const orch = fs.readFileSync("src/routes/api/public/hooks/daily-maintenance.ts", "utf8");
    for (const task of [
      "reconcile-pending",
      "verify-external-payers",
      "expire-licenses",
      "daily-license-check",
      "resend-confirmations",
      "auto-close-tickets",
      "cleanup-apk-jobs",
    ]) {
      expect(orch).toContain(task);
    }
    expect(orch).toContain("cronUnauthorized");
  });

  it("o segredo do cron é comparado em tempo constante e nunca é vazio", () => {
    const src = fs.readFileSync("src/lib/cron-auth.server.ts", "utf8");
    expect(src).toContain("expected.length < 16");
    expect(src).toContain("charCodeAt");
  });
});

describe("Antifraude — sem caminhos alternativos", () => {
  it("todo resgate de trial passa por evaluateTrial + assessAbuse", () => {
    for (const file of ["src/lib/license.functions.ts", "src/lib/referrals.functions.ts"]) {
      const src = fs.readFileSync(file, "utf8");
      expect(src).toContain("evaluateTrial");
      expect(src).toContain("assessAbuse");
    }
  });

  it("existe apenas um ponto de escrita na tabela trials", () => {
    const files = fs
      .readdirSync("src/lib")
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `src/lib/${f}`);
    const writers = files.filter((f) => /from\("trials"\)\s*\.insert/.test(fs.readFileSync(f, "utf8")));
    expect(writers).toEqual(["src/lib/license.server.ts"]);
  });
});
