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

type RuntimeEnv = Record<string, unknown> | undefined;

function copyRuntimeValue(env: RuntimeEnv, name: string): void {
  const value = env?.[name];
  if (typeof value === "string" && value.length > 0) {
    process.env[name] = value;
  }
}

export function alignServerBackendEnv(runtimeEnv?: RuntimeEnv): void {
  if (aligned) return;
  if (typeof process === "undefined" || !process.env) return;

  // Na hospedagem, alguns bindings só chegam no segundo argumento de fetch.
  // Copie somente as credenciais conhecidas antes de avaliar o alinhamento.
  for (const name of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FILES_SUPABASE_URL",
    "FILES_SUPABASE_PUBLISHABLE_KEY",
    "FILES_SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    copyRuntimeValue(runtimeEnv, name);
  }

  const clientUrl =
    process.env["VITE_SUPABASE_URL"] ||
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    undefined;
  const clientHost = host(clientUrl);
  if (!clientHost) return;

  const serverHost = host(process.env["SUPABASE_URL"]);
  const hasServiceKey = Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
  if (serverHost === clientHost && hasServiceKey) {
    aligned = true;
    return;
  }

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

  setEnv("SUPABASE_URL", filesUrl);
  setEnv("SUPABASE_SERVICE_ROLE_KEY", filesKey);
  if (filesPublishable) setEnv("SUPABASE_PUBLISHABLE_KEY", filesPublishable);
  if (process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    setEnv("SUPABASE_PUBLISHABLE_KEY", process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
  }
  setEnv("SUPABASE_PROJECT_ID", filesHost.split(".")[0] ?? "");
  aligned = true;

  console.warn(
    `[backend-env] Servidor realinhado para o projeto do navegador (${clientHost}).`,
  );
}

// Dynamic key so build-time env replacement never turns this into an invalid assignment.
function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) return;
  const env = globalThis.process?.env as Record<string, string | undefined> | undefined;
  if (env) env[key] = value;
}
