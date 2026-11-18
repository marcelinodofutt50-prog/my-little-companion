import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/admin-helpers.server";

export async function trackSchemaFailure(
  error: any, 
  context: string, 
  recovered = false, 
  metadata: any = {},
  userId?: string
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const route = metadata.route || "unknown_route";

    console.warn(`[tracking] Registrando falha de sincronização (${error.code || 'ERR'}):`, error.message);

    await (supabaseAdmin.from("integration_logs") as any).insert({
      source: "shadow-core-db",
      user_id: userId,
      action: "pgrst108_sync_error",
      outcome: recovered ? "recovered" : "failure",
      error: error.message || String(error),
      context: {
        error_code: error.code || "UNKNOWN",
        location: context,
        recovered,
        route,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    });

    // Gatilho de reparo imediato no backend se detectarmos falha de esquema
    if (error.code === 'PGRST108' || error.message?.includes('schema cache') || error.code === '42P01') {
      console.log("[tracking] Acionando reparo de esquema via RPC...");
      try {
        await supabaseAdmin.rpc("force_refresh_schema_permissions");
        // Toque tático agressivo para invalidar caches de borda
        await supabaseAdmin.from("tutorial_progress").select("*").limit(1).maybeSingle();
        await supabaseAdmin.from("tutorials").select("*").limit(1).maybeSingle();
      } catch (e) {
        console.error("[tracking] Repair cycle failed:", e);
      }
    }
  } catch (e) {
    console.error("[tracking] Failed to log failure:", e);
  }
}

export const listTutorials = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({
    metadata: z.object({
      route: z.string().optional(),
      force_repair: z.boolean().optional()
    }).optional()
  }).optional().parse(d || {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<any[]> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tutorials")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("[tutorials] Falha na consulta administrativa", { code: error.code });
      throw new Error("Não foi possível carregar as aulas.");
    }
    return data ?? [];
  });

export const adminSaveTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const emptyToNull = z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(1000).refine(
        (value) => /^https?:\/\//i.test(value) || /^[a-zA-Z0-9_./-]+$/.test(value),
        "Informe uma URL válida ou um arquivo do Centro de Treinamento.",
      ).nullish(),
    );
    return z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(3),
      description: z.string().min(5),
      video_url: emptyToNull,
      image_url: emptyToNull,
      youtube_url: emptyToNull,
      category: z.string().min(2),
      is_active: z.boolean().default(true),
      display_order: z.number().int().optional(),
    }).parse(input);
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, any> = { ...data, created_by: context.userId };
    if (!payload.id) delete payload.id;
    const { error } = await supabaseAdmin
        .from("tutorials")
        .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return { ok: true };
  });


export const adminDeleteTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tutorials").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const updateTutorialOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.array(z.object({
    id: z.string().uuid(),
    display_order: z.number().int()
  })).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const item of data) {
      await supabaseAdmin.from("tutorials").update({ display_order: item.display_order }).eq("id", item.id);
    }
    return { ok: true };
  });
