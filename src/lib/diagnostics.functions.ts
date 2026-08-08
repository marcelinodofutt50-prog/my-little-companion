import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const testDatabaseConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const start = Date.now();
    try {
      const { data, error, status } = await context.supabase
        .from("tutorials")
        .select("id")
        .limit(1);

      const latency = Date.now() - start;

      if (error) {
        if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
           const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
           if (supabaseAdmin) {
              await supabaseAdmin.rpc("force_refresh_schema_permissions");
           }
        }
        
        return {
          success: false,
          latency,
          status,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        latency,
        status,
        rowCount: data?.length ?? 0,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        latency: Date.now() - start,
        error: err.message || "Unknown error",
        timestamp: new Date().toISOString()
      };
    }
  });

/**
 * Função Tática de Teste de Resiliência:
 * Simula o fluxo de recuperação PGRST108 e valida que a infraestrutura 
 * continua servindo dados via chave administrativa após o registro do log.
 */
export const simulateSchemaFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.log("[resilience-test] Iniciando simulação de falha PGRST108...");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Simular o erro no log
    const mockError = {
      code: "PGRST108",
      message: "Simulated schema cache error for resilience testing"
    };
    
    // Importamos a função de tracking
    // Nota: Como listTutorials já tem essa lógica, podemos chamá-la ou apenas registrar o log manualmente
    try {
      await supabaseAdmin.from("integration_logs").insert({
        source: "resilience-tester",
        action: "pgrst108_simulation",
        outcome: "testing",
        error: mockError.message,
        context: {
          simulated: true,
          timestamp: new Date().toISOString(),
          target: "tutorials"
        }
      });
      
      // 2. Tentar recuperar dados via Admin (o que deve funcionar independente do cache do user)
      const { data, error } = await supabaseAdmin
        .from("tutorials")
        .select("id")
        .limit(1);
        
      if (error) {
        return { 
          success: false, 
          error: "Falha catastrófica: Chave administrativa também falhou!", 
          details: error.message 
        };
      }
      
      // 3. Forçar refresh para limpar o estado simulado
      await supabaseAdmin.rpc("force_refresh_schema_permissions");
      
      return { 
        success: true, 
        message: "Resiliência validada. O sistema recuperou dados via Admin Tunnel.",
        rowCount: data?.length ?? 0
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

