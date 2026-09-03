import { describe, it, expect } from "vitest";
import {
  buildTrainingReply,
  buildVisualErrorReply,
  isTrainingQuestion,
  isVisualNetworkError,
} from "../support-canned";

describe("isTrainingQuestion", () => {
  it("detecta pergunta sobre criar aplicativo na BTmob", () => {
    expect(isTrainingQuestion("como criar aplicativo na btmob?")).toBe(true);
    expect(isTrainingQuestion("Como faço pra criar o app no BTmob")).toBe(true);
    expect(isTrainingQuestion("me ensina a gerar o apk na btmob")).toBe(true);
  });

  it("detecta pergunta sobre como usar o login/painel", () => {
    expect(isTrainingQuestion("como usar o login?")).toBe(true);
    expect(isTrainingQuestion("como funciona o painel")).toBe(true);
    expect(isTrainingQuestion("como uso minha licença?")).toBe(true);
  });

  it("ignora relatos de erro comuns (não são dúvida de treinamento)", () => {
    expect(isTrainingQuestion("minha licença expirou")).toBe(false);
    expect(isTrainingQuestion("não consigo logar, senha inválida")).toBe(false);
    expect(isTrainingQuestion("oi bom dia")).toBe(false);
  });
});

describe("isVisualNetworkError", () => {
  it("detecta network error", () => {
    expect(isVisualNetworkError("tá aparecendo network error")).toBe(true);
    expect(isVisualNetworkError("NETWORK ERROR toda hora")).toBe(true);
  });

  it("detecta erro de internet/rede/conexão", () => {
    expect(isVisualNetworkError("deu erro de internet aqui")).toBe(true);
    expect(isVisualNetworkError("apareceu um erro de rede")).toBe(true);
    expect(isVisualNetworkError("erro de conexão no app")).toBe(true);
  });

  it("ignora outros erros", () => {
    expect(isVisualNetworkError("senha inválida")).toBe(false);
    expect(isVisualNetworkError("licença expirou")).toBe(false);
  });
});

describe("mensagens prontas", () => {
  it("resposta de treinamento aponta a Central de Treinamento", () => {
    const msg = buildTrainingReply();
    expect(msg).toContain("Central de Treinamento");
    expect(msg).toContain("Treinamento");
  });

  it("resposta de network error explica que é visual", () => {
    const msg = buildVisualErrorReply();
    expect(msg).toContain("visual");
    expect(msg).toMatch(/não interfere/i);
  });
});

describe("verificação de login por PIN", () => {
  it("detecta relato de problema de login", async () => {
    const { isLoginAccessIssue, extractPin } = await import("../support-canned");
    expect(isLoginAccessIssue("não consigo logar, senha inválida")).toBe(true);
    expect(isLoginAccessIssue("deu erro no painel btmob")).toBe(true);
    expect(isLoginAccessIssue("oi bom dia")).toBe(false);
    expect(isLoginAccessIssue("como criar aplicativo na btmob?")).toBe(false);
    expect(extractPin("meu pin é abcd-2345")).toBe("ABCD2345");
    expect(extractPin("oi tudo bem")).toBe(null);
  });
});
