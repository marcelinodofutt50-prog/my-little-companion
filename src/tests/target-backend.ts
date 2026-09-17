/**
 * Resolve qual banco os testes de produção devem verificar.
 *
 * Regra: o banco que o app realmente usa (`SUPABASE_URL`) é a fonte da verdade.
 * As variáveis `EXT_SUPABASE_*` só são usadas quando apontam para o MESMO
 * projeto (ou quando `SUPABASE_URL` não está configurada). Assim, credenciais
 * antigas esquecidas no ambiente de build não fazem os testes baterem em um
 * projeto desativado e derrubarem o deploy.
 */
function refOf(url: string | undefined): string | null {
  return url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]?.toLowerCase() ?? null;
}

const appUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const extUrl = process.env["EXT_SUPABASE_URL"];
const appRef = refOf(appUrl);
const extRef = refOf(extUrl);

const useExt = Boolean(extUrl) && (!appRef || appRef === extRef);

if (extUrl && !useExt) {
  console.warn(
    `[target-backend] Ignorando EXT_SUPABASE_* (${extRef}) — o app usa ${appRef}.`,
  );
}

export const TARGET_URL = (useExt ? extUrl : appUrl) as string;
export const TARGET_ANON = (useExt
  ? process.env["EXT_SUPABASE_PUBLISHABLE_KEY"]
  : process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) as string;
export const TARGET_SERVICE = (useExt
  ? process.env["EXT_SUPABASE_SERVICE_ROLE_KEY"]
  : process.env["SUPABASE_SERVICE_ROLE_KEY"]) as string;
