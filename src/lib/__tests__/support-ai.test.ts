
import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerSupportAI } from "../support-ai.server";
import { generateText } from "ai";
import { supabaseAdmin } from "../../../src/integrations/supabase/client.server";

// Mock das dependências externas
vi.mock("ai", () => ({
  generateText: vi.fn(),
  tool: vi.fn((config) => config),
  stepCountIs: vi.fn((n) => (steps: any) => steps.length >= n),
}));

vi.mock("../gemini-provider.server", () => ({
  createGeminiProvider: vi.fn(() => ({})),
  withGeminiFallback: vi.fn((run: any) => run({})),
  describeAiError: vi.fn((e: any) => String(e?.message ?? e)),
}));

// Criando o mock do Supabase com todas as funções encadeadas
const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  single: vi.fn().mockResolvedValue({ data: { id: "mock-id" }, error: null }),
  then: vi.fn((onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled)),
};

vi.mock("../../../src/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockSupabaseQuery),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "http://url" }, error: null }),
      })),
    },
  },
}));

vi.mock("../yaarsa.server", () => ({
  decrypt: vi.fn(() => "plain-password"),
  yaarsaExtend: vi.fn().mockResolvedValue({ ok: true }),
  yaarsaSetPassword: vi.fn().mockResolvedValue({ ok: true }),
  persistLog: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("Support AI Proactive Flow", () => {
  const threadId = "00000000-0000-0000-0000-000000000001";
  const userId = "00000000-0000-0000-0000-000000000002";
  const adminId = "00000000-0000-0000-0000-000000000003";

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults for maybeSingle/single
    mockSupabaseQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabaseQuery.single.mockResolvedValue({ data: { id: "mock-id" }, error: null });
  });

  it("should ignore messages without triggers", async () => {
    await triggerSupportAI(threadId, userId, "Olá, tudo bem?");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("should trigger AI for login error messages", async () => {
    await triggerSupportAI(threadId, userId, "Estou com erro ao logar no btmob");
    expect(generateText).toHaveBeenCalled();
    
    const callArgs = (generateText as any).mock.calls[0][0];
    expect(callArgs.prompt).toContain("Estou com erro ao logar no btmob");
    expect(callArgs.tools).toHaveProperty("checkCustomerStatus");
    expect(callArgs.tools).toHaveProperty("fixLogin");
    expect(callArgs.tools).toHaveProperty("postAIMessage");
  });

  it("should execute checkCustomerStatus tool correctly", async () => {
    await triggerSupportAI(threadId, userId, "erro de senha");
    const tools = (generateText as any).mock.calls[0][0].tools;
    
    const result = await tools.checkCustomerStatus.execute({});
    expect(supabaseAdmin.from).toHaveBeenCalledWith("licenses");
    expect(supabaseAdmin.from).toHaveBeenCalledWith("orders");
    expect(result).toHaveProperty("licenses");
    expect(result).toHaveProperty("recentOrders");
  });

  it("should execute fixLogin tool and handle successful fix", async () => {
    const mockLicense = {
      id: "lic-1",
      yaarsa_email: "test@test.com",
      yaarsa_password_enc: "encrypted",
      expires_at: new Date().toISOString(),
      panel: "v46",
      yaarsa_username: "user1"
    };

    mockSupabaseQuery.maybeSingle.mockResolvedValueOnce({ data: mockLicense, error: null });

    await triggerSupportAI(threadId, userId, "senha invalida");
    const tools = (generateText as any).mock.calls[0][0].tools;
    
    const result = await tools.fixLogin.execute({ licenseId: mockLicense.id });
    expect(result).toEqual({ ok: true, message: "Login corrigido com sucesso via Yaarsa API" });
  });

  it("should execute postAIMessage and mark thread as unread", async () => {
    mockSupabaseQuery.maybeSingle.mockResolvedValueOnce({ data: { user_id: adminId }, error: null });

    await triggerSupportAI(threadId, userId, "bug no login");
    const tools = (generateText as any).mock.calls[0][0].tools;

    await tools.postAIMessage.execute({ body: "Test message" });

    expect(supabaseAdmin.from).toHaveBeenCalledWith("user_roles");
    expect(supabaseAdmin.from).toHaveBeenCalledWith("support_messages");
    expect(supabaseAdmin.from).toHaveBeenCalledWith("support_threads");
    expect(mockSupabaseQuery.update).toHaveBeenCalledWith({ unread_by_customer: 1, last_staff_message_at: expect.any(String) });
  });
});


describe("PIX automático no checkout", () => {
  const threadId = "00000000-0000-0000-0000-000000000001";
  const userId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseQuery.maybeSingle.mockResolvedValue({
      data: { user_id: "00000000-0000-0000-0000-000000000003" },
      error: null,
    });
  });

  it("envia a chave PIX sem chamar a IA quando o checkout falha", async () => {
    await triggerSupportAI(threadId, userId, "não estou conseguindo abrir o checkout para pagar");
    expect(generateText).not.toHaveBeenCalled();
    const body = mockSupabaseQuery.insert.mock.calls[0][0].body as string;
    expect(body).toContain("bbfccc7e-73d6-4d19-ab8e-ac069ef622a4");
    expect(body).toContain("Bruno Gomes");
  });
});
