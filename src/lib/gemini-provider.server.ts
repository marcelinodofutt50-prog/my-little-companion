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

export function createGeminiProvider(modelName: string = DEFAULT_MODEL) {
  const bare = normalize(modelName);
  const geminiKey = process.env.GEMINI_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;

  if (lovableKey) {
    const lovable = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });
    return lovable(`google/${bare}`);
  }

  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return google(bare);
  }

  throw new Error("Nem LOVABLE_API_KEY nem GEMINI_API_KEY configuradas no servidor.");
}
