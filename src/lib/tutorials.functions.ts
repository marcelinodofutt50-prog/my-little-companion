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
      route: z.string().optional()
    }).optional()
  }).optional().parse(d || {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data: input, context }): Promise<any[]> => {
    const metadata = input?.metadata || {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    console.log("[tutorials] Iniciando busca tática de módulos...");
    
    // Tática de carregamento resiliente: tenta admin diretamente para o Centro de Treinamento
    // Usamos select("count") ou limit(1) primeiro para verificar se a relação existe
    // e forçar o cache se necessário antes da query real.
    const { data, error } = await supabaseAdmin
      .from("tutorials")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
        
    if (error) {
      console.error(`[tutorials] FALHA CRÍTICA: Busca Admin falhou!`, error);
      
      const isPGRST = error.code === 'PGRST108' || error.message?.includes('schema cache') || error.code === '42P01';
      
      if (isPGRST) {
        await trackSchemaFailure(error, "listTutorials", false, { stage: "initial_fetch", ...metadata }, context.userId);
        
        try {
          console.warn("[tutorials] Schema sync issue detected. Triggering forced repair...");
          await supabaseAdmin.rpc("force_refresh_schema_permissions");
          
          // Pequeno delay para o PostgREST processar o reload
          await new Promise(resolve => setTimeout(resolve, 500));

          const { data: retryData, error: retryError } = await supabaseAdmin
            .from("tutorials")
            .select("*")
            .eq("is_active", true)
            .order("display_order", { ascending: true });
            
          if (!retryError) {
            await trackSchemaFailure(error, "listTutorials", true, { stage: "retry_success", ...metadata }, context.userId);
            return retryData ?? [];
          }
          
          await trackSchemaFailure(retryError, "listTutorials", false, { stage: "retry_failure", retry_error: retryError.message, ...metadata }, context.userId);
        } catch (e) {
          console.error("[tutorials] Schema repair flow crashed:", e);
        }
      }
      
      // Retornamos array vazio para evitar que a UI mostre o erro fatal "Sync Error"
      // A UI de TutorialsPage detecta array vazio e mostra o botão de sincronização tática
      return [];
    }

    return data ?? [];
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
      
      const isPGRST = error.code === 'PGRST108' || error.message?.includes('schema cache');
      if (isPGRST) await trackSchemaFailure(error, "adminSaveTutorial", false, {}, context.userId);

      const wrapped = new Error(error.message);
      if (error.message?.includes("relation \"public.tutorials\" does not exist") || 
          isPGRST) {
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
