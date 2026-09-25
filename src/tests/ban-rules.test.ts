import { describe, it, expect } from "vitest";
import { shouldBanGroup, applyBanMultiplier, checkCommunityContent, TRIAL_DURATION_MS } from "@/lib/ban-rules";
describe("ban rules", () => {
  it("3 contas passam, 4 banem", () => { expect(shouldBanGroup(3)).toBe(false); expect(shouldBanGroup(4)).toBe(true); });
  it("acréscimo de preço", () => { expect(applyBanMultiplier(100, 1.5)).toBe(150); expect(applyBanMultiplier(100, 1)).toBe(100); expect(applyBanMultiplier(100, null)).toBe(100); });
  it("trial de 3h30", () => expect(TRIAL_DURATION_MS).toBe(12_600_000));
  it("bloqueia venda na comunidade", () => {
    expect(checkCommunityContent("fala tropa estou vendendo acesso diario por 25 conto").ok).toBe(false);
    expect(checkCommunityContent("meu discord xenon_plays.").ok).toBe(false);
    expect(checkCommunityContent("chama no zap 11 91234-5678").ok).toBe(false);
    expect(checkCommunityContent("alguém sabe configurar o painel?").ok).toBe(true);
    expect(checkCommunityContent("boa noite galera, funcionou aqui").ok).toBe(true);
  });
});
