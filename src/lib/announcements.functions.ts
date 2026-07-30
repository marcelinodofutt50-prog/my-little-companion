import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VersionTier } from "@/lib/plans";

export type AnnouncementSeverity = "info" | "warning" | "critical";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  min_tier: VersionTier;
  event_at: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
};

const tierRank: Record<VersionTier, number> = { weekly: 0, monthly_457: 1, lifetime_46: 2 };

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

async function bestTierRank(ctx: { supabase: any; userId: string }): Promise<number> {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return 2;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { data: lics } = await supabaseAdmin
    .from("licenses")
    .select("version_tier, expires_at, disabled_at, revoked, suspended_at")
    .eq("user_id", ctx.userId);
  const active = (lics ?? []).filter(
    (l: any) => !l.disabled_at && !l.revoked && !l.suspended_at && (!l.expires_at || l.expires_at > now),
  );
  return active.reduce(
    (acc: number, l: any) => Math.max(acc, tierRank[(l.version_tier ?? "monthly_457") as VersionTier] ?? 0),
    -1,
  );
}

/** Anúncios visíveis para o cliente logado (respeita agendamento e plano). */
export const listMyAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Announcement[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id, title, body, severity, min_tier, event_at, starts_at, ends_at, is_active, created_at")
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    const rank = await bestTierRank(context);
    return ((data ?? []) as any[])
      .filter((r) => !r.ends_at || r.ends_at > nowIso)
      .filter((r) => rank >= (tierRank[r.min_tier as VersionTier] ?? 0)) as Announcement[];
  });

/** Lista completa (admin) — inclui agendados e ocultos. */
export const adminListAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Announcement[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id, title, body, severity, min_tier, event_at, starts_at, ends_at, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as Announcement[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(140),
  body: z.string().trim().min(2).max(2000),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  min_tier: z.enum(["weekly", "monthly_457", "lifetime_46"]).default("weekly"),
  event_at: z.string().datetime({ offset: true }).nullable().optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  is_active: z.boolean().default(true),
});

export const adminSaveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      title: data.title,
      body: data.body,
      severity: data.severity,
      min_tier: data.min_tier,
      event_at: data.event_at ?? null,
      starts_at: data.starts_at ?? new Date().toISOString(),
      ends_at: data.ends_at ?? null,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("announcements").update(payload as any).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("announcements")
        .insert({ ...payload, created_by: context.userId } as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminToggleAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("announcements")
      .update({ is_active: data.is_active } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
