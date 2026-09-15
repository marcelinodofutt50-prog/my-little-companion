import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VersionTier } from "@/lib/plans";

const DOWNLOAD_TTL = 60 * 60 * 24; // 24h signed URL

const tierRank: Record<VersionTier, number> = { weekly: 0, monthly_457: 1, lifetime_46: 2, upgrade: 2 };

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

// ============ PUBLIC (authenticated) — list updates the user can access ============
export const listMyUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best tier from user's active licenses
    const now = new Date().toISOString();
    const { data: lics } = await supabaseAdmin
      .from("licenses")
      .select("plan_slug, version_tier, expires_at, disabled_at, revoked, suspended_at")
      .eq("user_id", context.userId);
    const active = (lics ?? []).filter((l: any) =>
      !l.disabled_at && !l.revoked && !l.suspended_at && (!l.expires_at || l.expires_at > now)
    );

    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    let bestRank = -1;
    if (isAdmin) bestRank = 2;
    else {
      for (const l of active) {
        const t = (l.version_tier ?? "monthly_457") as VersionTier;
        if (tierRank[t] > bestRank) bestRank = tierRank[t];
      }
    }
    if (bestRank < 0) return [];

    const { data: rows, error } = await supabaseAdmin
      .from("updates")
      .select("id, title, version, notes, min_tier, filename, size_bytes, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    return (rows ?? []).filter((r: any) => tierRank[r.min_tier as VersionTier] <= bestRank);
  });

// ============ Signed download URL for a specific update ============
export const getUpdateDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Bancos que ainda não receberam a coluna do link externo continuam
    // funcionando com o download tradicional.
    let row: any = null;
    const full = await supabaseAdmin
      .from("updates")
      .select("id, storage_path, part_paths, external_url, filename, min_tier, is_active")
      .eq("id", data.id)
      .maybeSingle();
    if (full.error && /external_url/i.test(full.error.message)) {
      const legacy = await supabaseAdmin
        .from("updates")
        .select("id, storage_path, part_paths, filename, min_tier, is_active")
        .eq("id", data.id)
        .maybeSingle();
      row = legacy.data;
    } else {
      row = full.data;
    }
    if (!row || !row.is_active) throw new Error("Update indisponível");


    // Verify tier access
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) {
      const now = new Date().toISOString();
      const { data: lics } = await supabaseAdmin
        .from("licenses").select("version_tier, expires_at, disabled_at, revoked, suspended_at")
        .eq("user_id", context.userId);
      const active = (lics ?? []).filter((l: any) =>
        !l.disabled_at && !l.revoked && !l.suspended_at && (!l.expires_at || l.expires_at > now)
      );
      const bestRank = active.reduce((acc: number, l: any) =>
        Math.max(acc, tierRank[(l.version_tier ?? "monthly_457") as VersionTier] ?? 0), -1);
      if (bestRank < tierRank[row.min_tier as VersionTier]) throw new Error("Seu plano não libera este update");
    }

    // Link externo: o cliente baixa direto da origem (Drive, R2, etc.), sem
    // passar pelo nosso armazenamento — é o caminho recomendado para arquivos
    // grandes, porque não consome a cota de tráfego do projeto.
    const external = ((row as any).external_url as string | null) ?? null;
    if (external) {
      return { url: external, urls: [external], filename: row.filename, external: true };
    }

    const paths = ((row as any).part_paths as string[] | null)?.length
      ? ((row as any).part_paths as string[])
      : [row.storage_path];

    const urls: string[] = [];
    for (const p of paths) {
      const { data: signed, error } = await supabaseAdmin.storage
        .from("updates")
        .createSignedUrl(p, DOWNLOAD_TTL, { download: row.filename });
      if (error || !signed) throw new Error(error?.message || "Falha ao gerar link");
      urls.push(signed.signedUrl);
    }
    return { url: urls[0]!, urls, filename: row.filename, external: false };
  });

// ============ ADMIN ============
export const adminListUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("updates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Return a signed upload URL for the admin to PUT the file directly into storage.
export const adminCreateUpdateUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      filename: z.string().min(1).max(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
    const { data: up, error } = await supabaseAdmin.storage
      .from("updates")
      .createSignedUploadUrl(path);
    if (error || !up) throw new Error(error?.message || "Falha ao gerar upload URL");
    return { uploadUrl: up.signedUrl, path, token: up.token };
  });

export const adminPublishUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      title: z.string().trim().min(2).max(120),
      version: z.string().trim().min(1).max(40),
      notes: z.string().trim().max(4000).optional().nullable(),
      min_tier: z.enum(["weekly", "monthly_457", "lifetime_46", "upgrade"]),
      storage_path: z.string().max(400).optional().nullable(),
      part_paths: z.array(z.string().min(1).max(400)).min(1).max(400).optional(),
      external_url: z.string().max(2000).optional().nullable(),
      filename: z.string().min(1).max(200),
      size_bytes: z.number().int().positive().max(20_000_000_000).optional().nullable(),
    })
      .refine((v) => Boolean(v.external_url?.trim() || v.storage_path?.trim()), {
        message: "Envie um arquivo ou informe o link externo.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeExternalUrl } = await import("@/lib/update-links");
    const externalUrl = data.external_url?.trim() ? normalizeExternalUrl(data.external_url) : null;
    const storagePath = externalUrl ? "" : (data.storage_path ?? "");
    const { error } = await supabaseAdmin.from("updates").insert({
      title: data.title,
      version: data.version,
      notes: data.notes ?? null,
      min_tier: data.min_tier,
      storage_path: storagePath,
      part_paths: externalUrl ? null : (data.part_paths ?? [storagePath]),
      external_url: externalUrl,
      filename: data.filename,
      size_bytes: data.size_bytes ?? null,
      created_by: context.userId,
      is_active: true,
    } as any);
    if (error) {
      if (externalUrl && /external_url/i.test(error.message)) {
        throw new Error(
          "Este banco ainda não tem o campo de link externo habilitado. Publique por envio de arquivo ou avise o suporte técnico.",
        );
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminToggleUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("updates").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("updates")
      .select("storage_path, part_paths")
      .eq("id", data.id)
      .maybeSingle();
    const toRemove = Array.from(
      new Set([...(((row as any)?.part_paths as string[] | null) ?? []), ...(row?.storage_path ? [row.storage_path] : [])]),
    );
    if (toRemove.length) {
      await supabaseAdmin.storage.from("updates").remove(toRemove);
    }
    const { error } = await supabaseAdmin.from("updates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
