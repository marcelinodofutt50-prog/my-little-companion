import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VersionTier } from "@/lib/plans";

const DOWNLOAD_TTL = 60 * 60 * 24; // 24h signed URL

const tierRank: Record<VersionTier, number> = { weekly: 0, monthly_457: 1, lifetime_46: 2 };

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
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("updates")
      .select("id, storage_path, filename, min_tier, is_active")
      .eq("id", data.id)
      .maybeSingle();
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

    const { data: signed, error } = await supabaseAdmin.storage
      .from("updates")
      .createSignedUrl(row.storage_path, DOWNLOAD_TTL, { download: row.filename });
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar link");
    return { url: signed.signedUrl, filename: row.filename };
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
  .inputValidator((input: unknown) =>
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
  .inputValidator((input: unknown) =>
    z.object({
      title: z.string().trim().min(2).max(120),
      version: z.string().trim().min(1).max(40),
      notes: z.string().trim().max(4000).optional().nullable(),
      min_tier: z.enum(["weekly", "monthly_457", "lifetime_46"]),
      storage_path: z.string().min(1).max(400),
      filename: z.string().min(1).max(200),
      size_bytes: z.number().int().positive().max(2_000_000_000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("updates").insert({
      title: data.title,
      version: data.version,
      notes: data.notes ?? null,
      min_tier: data.min_tier,
      storage_path: data.storage_path,
      filename: data.filename,
      size_bytes: data.size_bytes ?? null,
      created_by: context.userId,
      is_active: true,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("updates").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("updates").select("storage_path").eq("id", data.id).maybeSingle();
    if (row?.storage_path) {
      await supabaseAdmin.storage.from("updates").remove([row.storage_path]);
    }
    const { error } = await supabaseAdmin.from("updates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
