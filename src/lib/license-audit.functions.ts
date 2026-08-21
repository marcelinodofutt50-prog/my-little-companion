import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Equipe: histórico detalhado de alterações de licenças e logins. */
export const staffListLicenseAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      search: z.string().trim().max(120).optional(),
      eventType: z.string().trim().max(60).optional(),
      licenseId: z.string().uuid().optional(),
      limit: z.number().int().min(10).max(300).optional().default(100),
    }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/admin-helpers.server");
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("license_audit_events" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.licenseId) q = q.eq("license_id", data.licenseId);
    if (data.eventType && data.eventType !== "all") q = q.eq("event_type", data.eventType);
    if (data.search) q = q.ilike("yaarsa_email", `%${data.search}%`);

    const { data: rows, error } = await q;
    if (error) return { ok: false as const, events: [], message: error.message };

    const events = (rows ?? []) as any[];
    const ids = Array.from(
      new Set(events.flatMap((e) => [e.user_id, e.actor_id]).filter(Boolean)),
    ) as string[];

    const names = new Map<string, { email: string | null; display_name: string | null }>();
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles").select("id, email, display_name").in("id", ids);
      for (const p of profiles ?? []) {
        names.set((p as any).id, {
          email: (p as any).email ?? null,
          display_name: (p as any).display_name ?? null,
        });
      }
    }

    return {
      ok: true as const,
      events: events.map((e) => ({
        ...e,
        owner: e.user_id ? (names.get(e.user_id) ?? null) : null,
        actor: e.actor_id ? (names.get(e.actor_id) ?? null) : null,
      })),
    };
  });
