import { describe, it, expect } from "vitest";
import { buildKnowledgeEntry, collectCustomerQuestion, formatKnowledgeForPrompt, redactPersonalData } from "../support-learning";

const c = (body: string) => ({ body, is_admin: false, is_system: false });
const a = (body: string) => ({ body, is_admin: true, is_system: false });
const bot = (body: string) => ({ body, is_admin: true, is_system: true });

describe("aprendizado do robô", () => {
  it("junta as mensagens do cliente desde a última fala da equipe", () => {
    const q = collectCustomerQuestion([c("antiga"), a("resposta velha"), c("meu apk dá network error"), bot("🤖 ..."), c("ainda não foi")]);
    expect(q).toBe("meu apk dá network error\nainda não foi");
  });

  it("aprende com resposta útil da equipe", () => {
    const e = buildKnowledgeEntry([c("meu apk dá network error ao gerar")], "Confira se colocou permissões, imagem e tag antes de gerar o APK.");
    expect(e?.question).toContain("network error");
    expect(e?.answer).toContain("permissões");
  });

  it("ignora respostas vazias de conteúdo", () => {
    expect(buildKnowledgeEntry([c("meu apk dá network error")], "ok")).toBeNull();
    expect(buildKnowledgeEntry([c("meu apk dá network error")], "vou verificar")).toBeNull();
    expect(buildKnowledgeEntry([c("oi")], "Olá! Como posso ajudar você hoje com o painel?")).toBeNull();
  });

  it("não guarda dados pessoais", () => {
    const t = redactPersonalData("meu email é joao@gmail.com senha: abc123 protocolo TRL-260101-ABC12 tel 11999998888");
    expect(t).not.toContain("joao@gmail.com");
    expect(t).not.toContain("abc123");
    expect(t).not.toContain("TRL-260101");
    expect(t).not.toContain("11999998888");
  });

  it("formata casos para o robô", () => {
    expect(formatKnowledgeForPrompt([])).toBe("");
    expect(formatKnowledgeForPrompt([{ question: "q", answer: "r" }])).toContain("Equipe respondeu: r");
  });
});
