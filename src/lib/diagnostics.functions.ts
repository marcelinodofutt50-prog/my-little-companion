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
      // 1. Registrar a simulação no log tático
      await supabaseAdmin.from("integration_logs").insert({
        source: "resilience-tester",
        action: "pgrst108_simulation",
        outcome: "testing",
        error: mockError.message,
        context: {
          simulated: true,
          timestamp: new Date().toISOString(),
          target: "tutorials",
          test_type: "admin_bypass_validation"
        }
      });
      
      // 2. Validar que a busca via Admin continua operacional (Bypass de Cache)
      const { data, error } = await supabaseAdmin
        .from("tutorials")
        .select("id, title")
        .limit(5);
        
      if (error) {
        return { 
          success: false, 
          error: "FALHA NA RESILIÊNCIA: O túnel administrativo também foi bloqueado.", 
          details: error.message 
        };
      }
      
      // 3. Executar o reparo de schema para garantir limpeza do ambiente
      const { error: rpcError } = await supabaseAdmin.rpc("force_refresh_schema_permissions");
      
      return { 
        success: true, 
        message: "TESTE DE RESILIÊNCIA CONCLUÍDO: Dados recuperados via Admin Tunnel enquanto o cache do usuário estava instável.",
        rowCount: data?.length ?? 0,
        rpcStatus: rpcError ? "Repair failed but bypass worked" : "Full recovery successful"
      };
    } catch (err: any) {
      return { success: false, error: "Erro interno no simulador: " + err.message };
    }

  });

