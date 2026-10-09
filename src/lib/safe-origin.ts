/**
 * Aceita apenas origens de deploys explicitamente confiáveis para retornos e
 * notificações de pagamento. Não confie em curingas *.vercel.app ou
 * *.lovable.app: qualquer terceiro pode controlar um subdomínio próprio.
 */
export const DEFAULT_ORIGIN = "https://www.shadowdashstore.com";

function configuredOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const candidate = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    if (candidate.protocol !== "https:" && candidate.hostname !== "localhost") return null;
    return candidate.origin;
  } catch {
    return null;
  }
}

function trustedOrigins(): Set<string> {
  const origins = new Set([
    DEFAULT_ORIGIN,
    "https://shadowdashstore.com",
    // Domínio público atual do projeto.
    "https://my-little-companion-nu.vercel.app",
  ]);

  // Valores injetados pelo provedor de deploy são confiáveis porque vêm do
  // ambiente do servidor, não da requisição do cliente.
  for (const value of [
    process.env.PUBLIC_APP_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.LOVABLE_APP_URL,
  ]) {
    const origin = configuredOrigin(value);
    if (origin) origins.add(origin);
  }

  // Localhost só é permitido fora de produção.
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost");
    origins.add("http://127.0.0.1");
  }
  return origins;
}

/** Normaliza uma origem do cliente para uma origem exata permitida. */
export function safeReturnOrigin(input: string): string {
  try {
    const parsed = new URL(input);
    if (parsed.username || parsed.password) return DEFAULT_ORIGIN;
    if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:")) {
      return DEFAULT_ORIGIN;
    }
    const origin = parsed.origin;
    return trustedOrigins().has(origin) ? origin : DEFAULT_ORIGIN;
  } catch {
    return DEFAULT_ORIGIN;
  }
}
