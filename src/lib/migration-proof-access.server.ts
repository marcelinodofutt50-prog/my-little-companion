/** Only canonical owner/file keys are accepted, including routed secondary keys. */
export function migrationProofOwner(path: string): string | null {
  if (!path || /[%\\?#\u0000-\u001f\u007f]/.test(path)) return null;
  const raw = path.startsWith("s2/") ? path.slice(3) : path;
  const parts = raw.split("/");
  if (parts.length !== 2 || parts.some((part) => !part || part === "." || part === "..")) return null;
  const [owner] = parts;
  return owner && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner) ? owner : null;
}

/** Validate the whole batch before any privileged signer is called. */
export async function authorizeMigrationProofs(
  client: any,
  userId: string,
  paths: string[],
  assertAdmin: () => Promise<void>,
): Promise<void> {
  const owners = paths.map(migrationProofOwner);
  if (owners.some((owner) => !owner)) throw new Error("Comprovante não encontrado ou acesso negado.");
  if (!owners.some((owner) => owner !== userId)) return;
  // An administrator can read somebody else's proof only when it is actually
  // attached to that owner's migration request and visible through their RLS.
  await assertAdmin();
  for (const [index, path] of paths.entries()) {
    const owner = owners[index];
    if (owner === userId) continue;
    const { data, error } = await client.from("migration_requests")
      .select("id").eq("user_id", owner).contains("proof_paths", [path]).limit(1);
    if (error || !data?.length) throw new Error("Comprovante não encontrado ou acesso negado.");
  }
}