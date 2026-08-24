

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
