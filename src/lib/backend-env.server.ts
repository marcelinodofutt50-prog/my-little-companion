/**
 * Alinha o backend do servidor com o backend que o navegador usa.
 *
 * Depois da migração do banco, o navegador (VITE_SUPABASE_URL) passou a apontar
 * para o projeto novo. Se o ambiente do servidor ainda estiver com o endereço /
 * chaves do projeto antigo (ou sem a chave de serviço), tudo que roda no
 * servidor fala com o banco errado e devolve "Invalid token".
 *
 * Aqui detectamos essa divergência e corrigimos em tempo de execução usando as
 * credenciais do projeto novo (FILES_SUPABASE_*, que hoje hospeda também os
 * dados). Não altera nada quando o servidor já está correto.
 */

function host(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

let aligned = false;

export function alignServerBackendEnv(): void {
  if (aligned) return;
  aligned = true;
  if (typeof process === "undefined" || !process.env) return;

  const clientUrl =
    process.env["VITE_SUPABASE_URL"] ||
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    undefined;
  const clientHost = host(clientUrl);
  if (!clientHost) return;

  const serverHost = host(process.env["SUPABASE_URL"]);
  const hasServiceKey = Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
  if (serverHost === clientHost && hasServiceKey) return;

  const filesUrl = process.env["FILES_SUPABASE_URL"];
  const filesHost = host(filesUrl);
  const filesKey = process.env["FILES_SUPABASE_SERVICE_ROLE_KEY"];
  const filesPublishable = process.env["FILES_SUPABASE_PUBLISHABLE_KEY"];

  if (filesHost !== clientHost || !filesUrl || !filesKey) {
    console.error(
      "[backend-env] Servidor e navegador apontam para projetos diferentes " +
        `(servidor=${serverHost ?? "ausente"}, navegador=${clientHost}) e não há ` +
        "credenciais alternativas compatíveis para corrigir automaticamente.",
    );
    return;
  }

  process.env["SUPABASE_URL"] = filesUrl;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = filesKey;
  if (filesPublishable) process.env["SUPABASE_PUBLISHABLE_KEY"] = filesPublishable;
  if (process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    process.env["SUPABASE_PUBLISHABLE_KEY"] =
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  }
  process.env["SUPABASE_PROJECT_ID"] = filesHost.split(".")[0] ?? "";

  console.warn(
    `[backend-env] Servidor realinhado para o projeto do navegador (${clientHost}).`,
  );
}
