import { describe, expect, it } from "vitest";
import {
  SECONDARY_PREFIX,
  isSecondaryPath,
  splitByProject,
  stripSecondaryPrefix,
  withSecondaryPrefix,
} from "@/lib/storage-routing";

describe("roteamento de arquivos entre os dois projetos", () => {
  it("marca o caminho novo com o prefixo do projeto de arquivos", () => {
    expect(withSecondaryPrefix("user/1/app.apk")).toBe(`${SECONDARY_PREFIX}user/1/app.apk`);
  });

  it("não duplica o prefixo", () => {
    const once = withSecondaryPrefix("user/1/app.apk");
    expect(withSecondaryPrefix(once)).toBe(once);
  });

  it("reconhece e remove o prefixo", () => {
    expect(isSecondaryPath(`${SECONDARY_PREFIX}a/b.png`)).toBe(true);
    expect(isSecondaryPath("a/b.png")).toBe(false);
    expect(stripSecondaryPrefix(`${SECONDARY_PREFIX}a/b.png`)).toBe("a/b.png");
    expect(stripSecondaryPrefix("a/b.png")).toBe("a/b.png");
  });

  it("separa arquivos antigos dos novos", () => {
    const { secondary, primary } = splitByProject([
      "antigo/1.png",
      `${SECONDARY_PREFIX}novo/2.png`,
    ]);
    expect(primary).toEqual(["antigo/1.png"]);
    expect(secondary).toEqual([`${SECONDARY_PREFIX}novo/2.png`]);
  });
});
