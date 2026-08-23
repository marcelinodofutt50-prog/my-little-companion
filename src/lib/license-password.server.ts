/**
 * Atualização de licença tolerante a ambientes com esquema atrasado.
 *
 * Em produção o banco pode ainda não ter as colunas novas de sincronização de
 * senha (`password_sync_*`). Sem isso, o PostgREST devolve PGRST204/42703 e a
 * troca de senha do cliente falhava inteira — mesmo o campo principal
 * (`yaarsa_password_enc`) que é o que o cliente vê.
 *
 * Aqui removemos apenas a coluna que o banco não conhece e tentamos de novo,
 * garantindo que a senha chegue ao cliente. Devolvemos quais colunas foram
 * ignoradas para o chamador poder avisar/registrar.
 */

const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);
/** Colunas essenciais: se faltar alguma delas, é erro de verdade. */
const REQUIRED = new Set(["yaarsa_password_enc"]);

function missingColumnFrom(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  if (!MISSING_COLUMN_CODES.has(String(error.code))) return null;
  const m = /'([^']+)' column|column "([^"]+)"/i.exec(error.message ?? "");
  return m?.[1] ?? m?.[2] ?? null;
}

export async function updateLicenseTolerant(
  client: any,
  licenseId: string,
  patch: Record<string, unknown>,
): Promise<{ skipped: string[] }> {
  let payload = { ...patch };
  const skipped: string[] = [];

  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await client.from("licenses").update(payload).eq("id", licenseId);
    if (!error) return { skipped };

    const column = missingColumnFrom(error);
    if (!column || REQUIRED.has(column) || !(column in payload)) {
      throw new Error(`Não foi possível salvar a senha aqui: ${error.message}`);
    }
    delete payload[column];
    skipped.push(column);
    if (Object.keys(payload).length === 0) {
      throw new Error(`Não foi possível salvar a senha aqui: ${error.message}`);
    }
  }

  throw new Error("Não foi possível salvar a senha aqui.");
}
