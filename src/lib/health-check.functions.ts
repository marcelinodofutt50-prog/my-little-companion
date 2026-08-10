import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trackSchemaFailure } from "./tutorials.functions";

/**
 * Health Check Tático de Schema
 * Valida a integridade da comunicação entre o PostgREST e o Banco de Dados.
 * Projetado para rodar após o deploy ou em intervalos regulares.
 */
export const runSchemaHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = Date.now();
    
    console.log("[health-check] Iniciando validação de integridade pós-deploy...");
    
    try {
      // 1. Validar visibilidade da tabela principal via cliente padrão (RLS/Cache check)
      const { error: clientError } = await context.supabase
        .from("tutorials")
        .select("id")
        .limit(1);
        
      const clientHealthy = !clientError;
      const latency = Date.now() - start;

      // 2. Se houver falha de schema, tentar identificar a causa
      if (clientError) {
        const isPGRST108 = clientError.code === 'PGRST108' || clientError.message?.includes('schema cache');
        
        await trackSchemaFailure(
          clientError, 
          "post_deploy_health_check", 
          false, 
          { 
            stage: "client_validation",
            error_code: clientError.code,
            is_pgrst: isPGRST108
          }, 
          context.userId
        );

        // Tentar reparo automático imediato se for falha de cache
        if (isPGRST108) {
          console.warn("[health-check] Inconsistência detectada. Disparando auto-reparo...");
          await supabaseAdmin.rpc("force_refresh_schema_permissions");
        }

        return {
          status: "unstable",
          latency,
          error: clientError.message,
          code: clientError.code,
          timestamp: new Date().toISOString(),
          needs_repair: isPGRST108
        };
      }

      return {
        status: "healthy",
        latency,
        timestamp: new Date().toISOString()
      };

    } catch (err: any) {
      console.error("[health-check] Erro fatal durante execução:", err);
      return {
        status: "critical",
        error: err.message || "Erro interno de sistema",
        timestamp: new Date().toISOString()
      };
    }
  });
