import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
/**
 * Provedor Híbrido: Tenta usar a chave direta do Google (GEMINI_API_KEY)
 * Caso não exista ou falhe, cai para o Lovable AI Gateway como fallback.
 */
export function createGeminiProvider(modelName = "gemini-1.5-flash") {
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (geminiKey) {
        const google = createGoogleGenerativeAI({
            apiKey: geminiKey,
        });
        // Mapeamento de nomes se necessário (ex: 2.5/3.6 -> 1.5/2.0 pro SDK oficial)
        const normalizedName = modelName.includes("gemini")
            ? modelName.replace("google/", "").replace("3.6-", "1.5-").replace("2.5-", "1.5-")
            : modelName;
        return google(normalizedName);
    }
    if (lovableKey) {
        const lovable = createOpenAICompatible({
            name: "lovable",
            baseURL: "https://ai.gateway.lovable.dev/v1",
            headers: {
                "Lovable-API-Key": lovableKey,
                "X-Lovable-AIG-SDK": "vercel-ai-sdk",
            },
        });
        // O gateway espera o formato "google/gemini-..."
        const gatewayName = modelName.startsWith("google/") ? modelName : `google/${modelName}`;
        return lovable(gatewayName);
    }
    throw new Error("Nem GEMINI_API_KEY nem LOVABLE_API_KEY configuradas no servidor.");
}
