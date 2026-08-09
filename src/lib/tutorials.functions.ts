import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { data: admin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  const { data: mod } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "moderator" });
  if (!admin && !mod) throw new Error("Forbidden");
}

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
    if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
      console.log("[tracking] Acionando reparo de esquema via RPC...");
      await supabaseAdmin.rpc("force_refresh_schema_permissions");
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
  .handler(async ({ data: input, context }): Promise<any[]> => {
    const metadata = input?.metadata || {};
    
    const fetchWithRetry = async (attempt = 1): Promise<any[]> => {
      console.log(`[tutorials] Busca tática de módulos (Tentativa ${attempt})...`);
      
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      
      // Se for uma tentativa de reparo forçado, executamos o RPC antes da busca
      if (input?.metadata?.force_repair && attempt === 1) {
        console.log("[tutorials] Executando reparo forçado via RPC no Admin Tunnel...");
        await supabaseAdmin.rpc("force_refresh_schema_permissions");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Bypass total de RLS e Cache para a Knowledge Base
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from("tutorials")
        .select("*")
        .order("display_order", { ascending: true });
          
      if (adminError) {
        console.error(`[tutorials] Erro no Admin Tunnel:`, adminError);
        const isPGRST = adminError.code === 'PGRST108' || adminError.message?.includes('schema cache') || adminError.code === '42P01';
        
        if (isPGRST && attempt <= 3) {
          await trackSchemaFailure(adminError, "listTutorials", false, { stage: `retry_${attempt}`, ...metadata }, context.userId);
          // O trackSchemaFailure já aciona o RPC agora
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          return fetchWithRetry(attempt + 1);
        }
        return [];
      }

      const results = (adminData || []).filter(item => item && item.id && (item.title || item.category));
      console.log(`[tutorials] Admin Tunnel retornou ${results.length} módulos.`);
      return results;
    };

    return await fetchWithRetry();
  });

export const adminSaveTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(3),
      description: z.string().min(5),
      video_url: z.string().url().nullish(),
      image_url: z.string().url().nullish(),
      youtube_url: z.string().url().nullish(),
      category: z.string().min(2),
      is_active: z.boolean().default(true),
      display_order: z.number().int().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
        .from("tutorials")
        .upsert({ ...data, created_by: context.userId });
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
