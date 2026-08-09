import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { data: admin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  const { data: mod } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "moderator" });
  if (!admin && !mod) throw new Error("Forbidden");
}

/** 
 * Sistema de Rastreamento Tático de Falhas de Schema (PGRST108)
 * Registra no banco de dados todas as ocorrências de cache corrompido e resultados de reparo.
 */
/** 
 * Sistema de Rastreamento Tático de Falhas de Schema (PGRST108)
 * Registra no banco de dados todas as ocorrências de cache corrompido e resultados de reparo.
 * Agora inclui correlação por usuário e rastreamento da rota para diagnósticos avançados.
 */
export async function trackSchemaFailure(
  error: any, 
  context: string, 
  recovered = false, 
  metadata: any = {},
  userId?: string
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Obter URL/Rota se estiver em um ambiente que permita
    const route = metadata.route || "unknown_route";

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const fetchWithRetry = async (attempt = 1): Promise<any[]> => {
      console.log(`[tutorials] Busca tática de módulos (Tentativa ${attempt})...`);
      
      // Tentativa inicial via Admin (Data Tunnel) para bypass de cache PostgREST
      const { data, error } = await supabaseAdmin
        .from("tutorials")
        .select("*")
        .order("display_order", { ascending: true });
          
      if (error) {
        const isPGRST = error.code === 'PGRST108' || error.message?.includes('schema cache') || error.code === '42P01';
        
        if (isPGRST && attempt <= 3) {
          console.warn(`[tutorials] Instabilidade de schema detectada (Tentativa ${attempt}). Iniciando backoff...`);
          await trackSchemaFailure(error, "listTutorials", false, { stage: `retry_${attempt}`, ...metadata }, context.userId);
          
          // Backoff exponencial: 800ms, 1600ms, 3200ms
          const delay = 800 * Math.pow(2, attempt - 1);
          
          // Força reparo de schema antes da próxima tentativa
          try {
            await supabaseAdmin.rpc("force_refresh_schema_permissions");
          } catch (rpcErr) {
            console.error("[tutorials] Falha ao disparar force_refresh:", rpcErr);
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(attempt + 1);
        }
        
        console.error(`[tutorials] FALHA CRÍTICA após retentativas:`, error);
        // Telemetria final de falha total
        await trackSchemaFailure(error, "listTutorials_FINAL_FAILURE", false, { 
          total_attempts: attempt,
          metadata 
        }, context.userId);
        return [];
      }

      if (attempt > 1 || (data && data.length > 0)) {
        await trackSchemaFailure({ message: attempt > 1 ? "Recovered via backoff" : "Successful fetch" }, "listTutorials", true, { stage: `retry_${attempt}_success`, ...metadata, row_count: data?.length }, context.userId);
      }
      
      // Validar dados recebidos (evitar itens nulos por corrupção parcial)
      return (data || []).filter(item => item && item.id && item.title);
    };

    return fetchWithRetry();
  });

export const adminSaveTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
      description: z.string().min(5, "Descrição deve ter pelo menos 5 caracteres"),
      video_url: z.string().url().nullish(),
      image_url: z.string().url().nullish(),
      youtube_url: z.string().url().nullish(),
      category: z.string().min(2, "Categoria é obrigatória"),
      is_active: z.boolean().default(true),
      display_order: z.number().int().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
        .from("tutorials")
        .upsert({ ...data, created_by: context.userId });
    if (error) {
      console.error("[tutorials] Database error:", error);
      
      const isPGRST = error.code === 'PGRST108' || error.message?.includes('schema cache') || error.code === '42P01' || error.message?.includes('does not exist');
      
      if (isPGRST) {
        await trackSchemaFailure(error, "adminSaveTutorial", false, { stage: "initial_upsert" }, context.userId);
        
        // Força refresh imediato no admin se falhar a escrita
        try {
          await supabaseAdmin.rpc("force_refresh_schema_permissions");
          await new Promise(resolve => setTimeout(resolve, 800));
          const { error: retryError } = await supabaseAdmin
            .from("tutorials")
            .upsert({ ...data, created_by: context.userId });
            
          if (!retryError) {
             await trackSchemaFailure(error, "adminSaveTutorial", true, { stage: "retry_upsert_success" }, context.userId);
             return { ok: true };
          }
        } catch (e) {
          console.error("[tutorials] Admin upsert repair flow failed:", e);
        }
      }

      const wrapped = new Error(error.message);
      if (error.message?.includes("relation \"public.tutorials\" does not exist") || isPGRST) {
        (wrapped as any)._schemaError = "public.tutorials";
      }
      throw wrapped;
    }

    return { ok: true };
  });

export const adminDeleteTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tutorials").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
      const { error } = await supabaseAdmin
        .from("tutorials")
        .update({ display_order: item.display_order })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    }
    
    return { ok: true };
  });
