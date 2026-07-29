/** Lista de liberação manual do antifraude (somente servidor). */

export async function allowConnection(input: {
  ipHash: string;
  reason?: string | null;
  adminId: string;
  adminEmail?: string | null;
  hours?: number | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expires =
    input.hours && input.hours > 0
      ? new Date(Date.now() + input.hours * 60 * 60 * 1000).toISOString()
      : null;

  const { error } = await supabaseAdmin.from("antifraud_allowlist").upsert(
    {
      ip_hash: input.ipHash,
      reason: input.reason ?? null,
      created_by: input.adminId,
      created_by_email: input.adminEmail ?? null,
      expires_at: expires,
    },
    { onConflict: "ip_hash" },
  );
  if (error) throw new Error("Não foi possível liberar esta conexão.");
  return { ok: true, expiresAt: expires };
}

export async function revokeConnection(ipHash: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("antifraud_allowlist")
    .delete()
    .eq("ip_hash", ipHash);
  if (error) throw new Error("Não foi possível remover a liberação.");
  return { ok: true };
}
