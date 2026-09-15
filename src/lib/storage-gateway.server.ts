/**
 * Porta de entrada única para leitura/escrita de arquivos.
 *
 * Arquivos novos são gravados no projeto secundário (só de arquivos); arquivos
 * antigos continuam sendo lidos do projeto principal. Todo o resto do código
 * usa as funções deste módulo e não precisa saber onde o arquivo está.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSecondaryPath, splitByProject, withSecondaryPrefix } from "./storage-routing";

let cachedFiles: SupabaseClient | null = null;

export function filesStorageEnabled(): boolean {
  return Boolean(process.env["FILES_SUPABASE_URL"] && process.env["FILES_SUPABASE_SERVICE_ROLE_KEY"]);
}

export function filesAdmin(): SupabaseClient {
  if (cachedFiles) return cachedFiles;
  const url = process.env["FILES_SUPABASE_URL"];
  const key = process.env["FILES_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Armazenamento de arquivos não configurado.");
  cachedFiles = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedFiles;
}

async function primaryAdmin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/** Cliente correto para um caminho já existente. */
export async function storageClientFor(path: string): Promise<SupabaseClient> {
  if (isSecondaryPath(path) && filesStorageEnabled()) return filesAdmin();
  return primaryAdmin();
}

/**
 * Gera uma URL assinada de upload para um arquivo NOVO.
 * Devolve o caminho já com o prefixo do projeto de arquivos (quando ativo).
 */
export async function createUpload(
  bucket: string,
  rawPath: string,
): Promise<{ path: string; uploadUrl: string; token: string }> {
  const useSecondary = filesStorageEnabled();
  const path = useSecondary ? withSecondaryPrefix(rawPath) : rawPath.replace(/^\/+/, "");
  const client = useSecondary ? filesAdmin() : await primaryAdmin();
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message || "Falha ao gerar URL de upload");
  return { path, uploadUrl: data.signedUrl, token: data.token };
}

/** Envia bytes direto do servidor para o projeto certo (arquivo novo). */
export async function uploadBytes(
  bucket: string,
  rawPath: string,
  body: Blob | ArrayBuffer | Uint8Array | string,
  opts?: { contentType?: string; upsert?: boolean; cacheControl?: string },
): Promise<{ path: string }> {
  const useSecondary = filesStorageEnabled();
  const path = useSecondary ? withSecondaryPrefix(rawPath) : rawPath.replace(/^\/+/, "");
  const client = useSecondary ? filesAdmin() : await primaryAdmin();
  const { error } = await client.storage.from(bucket).upload(path, body as any, {
    contentType: opts?.contentType,
    upsert: opts?.upsert ?? false,
    cacheControl: opts?.cacheControl,
  });
  if (error) throw new Error(error.message);
  return { path };
}

/** Link temporário de download, buscando no projeto onde o arquivo está. */
export async function createDownload(
  bucket: string,
  path: string,
  ttlSeconds: number,
  opts?: { download?: string | boolean },
): Promise<string> {
  const client = await storageClientFor(path);
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds, opts as any);
  if (error || !data) throw new Error(error?.message || "Falha ao gerar link do arquivo");
  return data.signedUrl;
}

/** Vários links de uma vez; a ordem de entrada é preservada. */
export async function createDownloads(
  bucket: string,
  paths: string[],
  ttlSeconds: number,
  opts?: { download?: string | boolean },
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const { secondary, primary } = splitByProject(paths);
  const jobs: Array<[SupabaseClient, string[]]> = [];
  if (secondary.length) jobs.push([filesStorageEnabled() ? filesAdmin() : await primaryAdmin(), secondary]);
  if (primary.length) jobs.push([await primaryAdmin(), primary]);
  for (const [client, list] of jobs) {
    const { data } = await client.storage.from(bucket).createSignedUrls(list, ttlSeconds, opts as any);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
    }
  }
  return out;
}

/** Baixa o conteúdo do arquivo no servidor (usado por workers internos). */
export async function downloadObject(bucket: string, path: string): Promise<Blob> {
  const client = await storageClientFor(path);
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) throw new Error(error?.message || "Arquivo não encontrado");
  return data;
}

/** Apaga arquivos nos dois projetos conforme o caminho de cada um. */
export async function removeObjects(bucket: string, paths: Array<string | null | undefined>): Promise<void> {
  const { secondary, primary } = splitByProject(paths);
  if (secondary.length && filesStorageEnabled()) {
    await filesAdmin().storage.from(bucket).remove(secondary);
  } else if (secondary.length) {
    await (await primaryAdmin()).storage.from(bucket).remove(secondary);
  }
  if (primary.length) {
    await (await primaryAdmin()).storage.from(bucket).remove(primary);
  }
}

/** URL pública (bucket público, ex.: avatares). */
export function publicUrlFor(bucket: string, path: string): string {
  if (isSecondaryPath(path) && filesStorageEnabled()) {
    const { data } = filesAdmin().storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
  const base = process.env["SUPABASE_URL"];
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
