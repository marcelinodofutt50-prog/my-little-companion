/**
 * Move os arquivos ANTIGOS (APK, atualizações e anexos do suporte) do projeto
 * principal para o projeto de arquivos, e atualiza os caminhos no banco.
 *
 * Uso:
 *   bun scripts/migrate-legacy-files.ts --dry-run
 *   bun scripts/migrate-legacy-files.ts
 *
 * Seguro de repetir: arquivos já movidos (prefixo s2/) são ignorados, e o
 * original só é apagado depois que a cópia e o banco já apontam para o novo.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const DRY = process.argv.includes("--dry-run");
const KEEP = process.argv.includes("--keep-origin");

const PRIMARY_URL = process.env["EXT_SUPABASE_URL"] || process.env["SUPABASE_URL"]!;
const PRIMARY_KEY =
  process.env["EXT_SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const DB_URL = process.env["EXT_SUPABASE_DB_URL"] || process.env["SUPABASE_DB_URL"]!;
const FILES_URL = process.env["FILES_SUPABASE_URL"]!;
const FILES_KEY = process.env["FILES_SUPABASE_SERVICE_ROLE_KEY"]!;

const BUCKETS = ["apk-uploads", "apk-results", "updates", "support-media"] as const;
const PREFIX = "s2/";

const primary = createClient(PRIMARY_URL, PRIMARY_KEY, { auth: { persistSession: false } });
const files = createClient(FILES_URL, FILES_KEY, { auth: { persistSession: false } });

function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function walk(
  client: SupabaseClient,
  bucket: string,
  prefix = "",
  out: { path: string; size: number }[] = [],
  depth = 0,
): Promise<{ path: string; size: number }[]> {
  if (depth > 6) return out;
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) out.push({ path: full, size: (item as any).metadata?.size ?? 0 });
    else await walk(client, bucket, full, out, depth + 1);
  }
  return out;
}

/** SQL que reaponta o banco para o caminho novo, bucket a bucket. */
function sqlFor(bucket: string, from: string, to: string): string[] {
  switch (bucket) {
    case "apk-uploads":
      return [`UPDATE public.apk_jobs SET source_path = ${q(to)} WHERE source_path = ${q(from)};`];
    case "apk-results":
      return [`UPDATE public.apk_jobs SET result_path = ${q(to)} WHERE result_path = ${q(from)};`];
    case "updates":
      return [
        `UPDATE public.updates SET storage_path = ${q(to)} WHERE storage_path = ${q(from)};`,
        `UPDATE public.updates SET part_paths = array_replace(part_paths, ${q(from)}, ${q(to)}) WHERE ${q(from)} = ANY(part_paths);`,
      ];
    case "support-media":
      return [
        `UPDATE public.support_messages SET attachment_url = replace(attachment_url, ${q("/support-media/" + from)}, ${q("/support-media/" + to)}) WHERE attachment_url LIKE ${q("%/support-media/" + from + "%")};`,
      ];
    default:
      return [];
  }
}

async function run() {
  console.log(`Origem: ${PRIMARY_URL}\nDestino: ${FILES_URL}\nModo: ${DRY ? "simulação" : "real"}\n`);
  const statements: string[] = [];
  const moved: { bucket: string; path: string }[] = [];
  let skipped = 0;
  let bytes = 0;

  for (const bucket of BUCKETS) {
    let items: { path: string; size: number }[];
    try {
      items = await walk(primary, bucket);
    } catch (e: any) {
      console.log(`[${bucket}] não foi possível listar: ${e.message}`);
      continue;
    }
    const pending = items.filter((i) => !i.path.startsWith(PREFIX));
    skipped += items.length - pending.length;
    console.log(`[${bucket}] ${pending.length} arquivo(s) para mover (${items.length} no total)`);

    for (const item of pending) {
      const target = `${PREFIX}${item.path}`;
      if (DRY) {
        statements.push(...sqlFor(bucket, item.path, target));
        moved.push({ bucket, path: item.path });
        bytes += item.size;
        continue;
      }
      const { data: blob, error: dlErr } = await primary.storage.from(bucket).download(item.path);
      if (dlErr || !blob) {
        console.log(`  ! falha ao baixar ${item.path}: ${dlErr?.message}`);
        continue;
      }
      const { error: upErr } = await files.storage
        .from(bucket)
        .upload(target, blob, { upsert: true, contentType: blob.type || undefined });
      if (upErr) {
        console.log(`  ! falha ao enviar ${target}: ${upErr.message}`);
        continue;
      }
      statements.push(...sqlFor(bucket, item.path, target));
      moved.push({ bucket, path: item.path });
      bytes += item.size;
      console.log(`  ok ${item.path} -> ${target}`);
    }
  }

  console.log(
    `\nTotal: ${moved.length} arquivo(s), ${(bytes / 1048576).toFixed(1)} MB; ${skipped} já estavam no destino.`,
  );
  if (!statements.length) return;

  const sqlPath = "/tmp/legacy-paths.sql";
  writeFileSync(sqlPath, `BEGIN;\n${statements.join("\n")}\nCOMMIT;\n`);
  console.log(`SQL gravado em ${sqlPath}`);
  if (DRY) return;

  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], { stdio: "inherit" });
  console.log("Banco atualizado.");

  if (KEEP) return;
  const byBucket = new Map<string, string[]>();
  for (const m of moved) byBucket.set(m.bucket, [...(byBucket.get(m.bucket) ?? []), m.path]);
  for (const [bucket, paths] of byBucket) {
    const { error } = await primary.storage.from(bucket).remove(paths);
    console.log(error ? `  ! limpeza ${bucket}: ${error.message}` : `  limpeza ${bucket}: ${paths.length} removido(s)`);
  }
}

run().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
