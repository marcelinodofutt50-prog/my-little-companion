import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Provedor Gemini. Prioriza o Lovable AI Gateway (sempre disponível e com os
 * modelos Gemini atuais). Só usa a chave direta do Google quando existir.
 *
 * Importante: nomes antigos como "gemini-1.5-flash" foram descontinuados e
 * retornavam 404 (o chat quebrava com uma página de erro HTML). Normalizamos
 * qualquer nome legado para o modelo atual.
 */
const DEFAULT_MODEL = "gemini-3.6-flash";

function normalize(modelName: string) {
  const bare = (modelName || "").replace(/^google\//, "").trim();
  if (!bare || /^gemini-(1\.5|1\.0|pro|2\.0)/.test(bare)) return DEFAULT_MODEL;
  return bare;
}

function lovableModel(bare: string, key: string) {
  const lovable = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  return lovable(`google/${bare}`);
}

export function createGeminiProvider(modelName: string = DEFAULT_MODEL) {
  const bare = normalize(modelName);
  const geminiKey = process.env.GEMINI_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;

  if (lovableKey) return lovableModel(bare, lovableKey);

  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return google(bare);
  }

  throw new Error("Nem LOVABLE_API_KEY nem GEMINI_API_KEY configuradas no servidor.");
}

/**
 * Lista de modelos disponíveis, na ordem de preferência. Usada para tentar o
 * gateway e, se ele falhar (cota, 429, 5xx), cair para a chave direta do
 * Google — e vice-versa. Sem isso, um estouro de cota do tier gratuito
 * derrubava a reescrita de mensagens no suporte.
 */
export function geminiProviderChain(modelName: string = DEFAULT_MODEL) {
  const bare = normalize(modelName);
  const chain: Array<{ label: string; model: ReturnType<typeof createGeminiProvider> }> = [];
  const lovableKey = process.env.LOVABLE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (lovableKey) chain.push({ label: "lovable-gateway", model: lovableModel(bare, lovableKey) });
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    chain.push({ label: "google-direct", model: google(bare) as any });
  }
  return chain;
}

export function describeAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (/quota|rate limit|429|exceeded/i.test(raw)) {
    return "A IA atingiu o limite de uso agora. Aguarde alguns segundos e tente de novo.";
  }
  if (/401|unauthor|api key|api_key/i.test(raw)) {
    return "A IA não está configurada no servidor (chave ausente ou inválida).";
  }
  if (/402|credit/i.test(raw)) {
    return "Os créditos de IA acabaram. Recarregue para continuar usando a reescrita.";
  }
  if (/timeout|network|fetch failed|5\d\d/i.test(raw)) {
    return "A IA está instável no momento. Tente novamente em instantes.";
  }
  return raw || "Falha ao chamar a IA.";
}

/** Executa uma chamada de IA tentando cada provedor da cadeia. */
export async function withGeminiFallback<T>(
  run: (model: any) => Promise<T>,
  modelName?: string,
): Promise<T> {
  const chain = geminiProviderChain(modelName);
  if (!chain.length) throw new Error("Nem LOVABLE_API_KEY nem GEMINI_API_KEY configuradas no servidor.");

  let lastError: unknown = null;
  for (const entry of chain) {
    try {
      return await run(entry.model);
    } catch (err) {
      lastError = err;
      console.error(`[ai] provedor ${entry.label} falhou:`, err instanceof Error ? err.message : err);
    }
  }
  throw new Error(describeAiError(lastError));
}
