// Runtime validation for required environment variables.
// Runs once at server startup so misconfiguration surfaces early
// (instead of the first request into a server function).

type EnvSpec = {
  name: string;
  required: boolean;
  description: string;
};

const CLIENT_ENV: EnvSpec[] = [
  { name: "VITE_SUPABASE_URL", required: true, description: "Supabase project URL (client)" },
  { name: "VITE_SUPABASE_PUBLISHABLE_KEY", required: true, description: "Supabase publishable key (client)" },
  { name: "VITE_SUPABASE_PROJECT_ID", required: false, description: "Supabase project ref (client)" },
];

const SERVER_ENV: EnvSpec[] = [
  { name: "IP_HASH_SALT", required: true, description: "Server-only secret used to hash IP addresses (minimum 32 characters)" },
  { name: "SUPABASE_URL", required: true, description: "Supabase project URL (server)" },
  { name: "SUPABASE_PUBLISHABLE_KEY", required: true, description: "Supabase publishable key (server)" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, description: "Supabase service role key (server-only, used by admin client, referrals, webhooks)" },
  { name: "STRIPE_SANDBOX_API_KEY", required: true, description: "Chave de conexão do provedor de pagamento (ambiente de teste)" },
  { name: "PAYMENTS_SANDBOX_WEBHOOK_SECRET", required: true, description: "Segredo de assinatura do webhook de pagamentos (teste)" },
  { name: "STRIPE_LIVE_API_KEY", required: false, description: "Chave de conexão do provedor de pagamento (produção)" },
  { name: "PAYMENTS_LIVE_WEBHOOK_SECRET", required: false, description: "Segredo de assinatura do webhook de pagamentos (produção)" },
  { name: "MERCADOPAGO_ACCESS_TOKEN", required: false, description: "Access token do Mercado Pago (checkout alternativo)" },
  { name: "MERCADOPAGO_PUBLIC_KEY", required: false, description: "Public key do Mercado Pago" },
  { name: "MERCADOPAGO_WEBHOOK_SECRET", required: false, description: "Chave secreta da notificação (webhook) do Mercado Pago" },

  { name: "YAARSA_BASE_URL", required: true, description: "Yaarsa v4.5.7 panel base URL" },
  { name: "YAARSA_ADMIN_KEY", required: true, description: "Yaarsa v4.5.7 admin key" },
  { name: "YAARSA_V46_BASE_URL", required: true, description: "Yaarsa v4.6 panel base URL" },
  { name: "YAARSA_V46_ADMIN_KEY", required: true, description: "Yaarsa v4.6 admin key" },
  { name: "LICENSE_ENC_KEY", required: true, description: "Symmetric key for encrypting stored panel credentials" },
  { name: "APK_WORKER_HMAC_SECRET", required: true, description: "HMAC secret used by the APK worker" },
  { name: "CRON_SECRET", required: true, description: "Bearer token required by scheduled reconciliation endpoints" },
];

let didValidateServer = false;

/**
 * Validate that required server-side environment variables are present.
 * Safe to call multiple times; only runs once per process. Never throws —
 * missing values are logged so the app can still boot and surface a
 * targeted error at the specific call site (e.g. checkout, webhook).
 */
export function validateServerEnv(): { ok: boolean; missing: string[] } {
  if (didValidateServer) return { ok: true, missing: [] };
  didValidateServer = true;

  const missing: string[] = [];
  for (const spec of SERVER_ENV) {
    const value = process.env[spec.name];
    const invalidIpSalt = spec.name === "IP_HASH_SALT" && (value?.trim().length ?? 0) < 32;
    if (spec.required && (!value || value.trim() === "" || invalidIpSalt)) {
      missing.push(spec.name);
    }
  }

  if (missing.length > 0) {
    console.error(
      `[env] Missing required server environment variables: ${missing.join(", ")}. ` +
      `Some features will fail until these are configured. ` +
      `See src/lib/env-validation.ts for the full list.`,
    );
    for (const name of missing) {
      const spec = SERVER_ENV.find((s) => s.name === name)!;
      console.error(`  - ${name}: ${spec.description}`);
    }
  } else {
    console.log("[env] All required server environment variables are present.");
  }

  return { ok: missing.length === 0, missing };
}

/**
 * Validate client-visible env vars. Called from the browser entry via the
 * Supabase client; kept here so both audits live side by side.
 */
export function validateClientEnv(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const spec of CLIENT_ENV) {
    const value = (import.meta.env as Record<string, string | undefined>)[spec.name];
    if (spec.required && (!value || value.trim() === "")) {
      missing.push(spec.name);
    }
  }
  if (missing.length > 0) {
    console.error(
      `[env] Missing required client environment variables: ${missing.join(", ")}.`,
    );
  }
  return { ok: missing.length === 0, missing };
}

export const REQUIRED_SERVER_ENV = SERVER_ENV;
export const REQUIRED_CLIENT_ENV = CLIENT_ENV;
