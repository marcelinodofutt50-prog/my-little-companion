/**
 * Checagem de e-mail já cadastrado (somente servidor).
 * Fica fora do arquivo .functions.ts porque helpers irmãos de um
 * createServerFn são removidos do bundle (ReferenceError em runtime).
 */
import { canonicalEmail, splitEmail } from "@/lib/email-canonical";

export type EmailAvailability = {
  /** false = já existe conta nessa caixa de entrada */
  available: boolean;
  /** e-mail exato já cadastrado (mascarado) quando encontrado por alias */
  aliasOf?: string | null;
  reason?: string;
};

function maskEmail(email: string): string {
  const parts = splitEmail(email);
  if (!parts) return "***";
  const { local, domain } = parts;
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

/**
 * Procura contas existentes na mesma caixa de entrada (inclui aliases do Gmail).
 * Usa o client admin porque a checagem acontece antes de existir sessão.
 */
export async function checkEmailAvailability(rawEmail: string): Promise<EmailAvailability> {
  const canonical = canonicalEmail(rawEmail);
  const parts = splitEmail(rawEmail);
  if (!canonical || !parts) return { available: false, reason: "E-mail inválido." };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Match exato — barato e cobre a maioria dos casos.
    const exact = await supabaseAdmin
      .from("profiles")
      .select("email")
      .ilike("email", `${parts.local}@${parts.domain}`)
      .limit(1);
    if (exact.data && exact.data.length > 0) {
      return { available: false, aliasOf: maskEmail(exact.data[0].email), reason: "exact" };
    }

    // 2) Aliases (pontos / +tag) no mesmo domínio.
    const firstChar = parts.local[0] ?? "";
    const like = firstChar ? `${firstChar}%@${parts.domain}` : `%@${parts.domain}`;
    const rows = await supabaseAdmin
      .from("profiles")
      .select("email")
      .ilike("email", like)
      .limit(2000);
    const hit = (rows.data ?? []).find((r) => canonicalEmail(r.email ?? "") === canonical);
    if (hit) return { available: false, aliasOf: maskEmail(hit.email), reason: "alias" };

    return { available: true };
  } catch {
    // Falha de infra nunca deve travar cadastro legítimo: o Supabase Auth
    // ainda barra e-mail exatamente duplicado.
    return { available: true, reason: "check_unavailable" };
  }
}
