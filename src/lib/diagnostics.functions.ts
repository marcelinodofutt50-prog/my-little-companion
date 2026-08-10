import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDiagnosticData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    const { data, error, status } = await supabase
      .from("profiles")
      .select("metadata, vip_tier")
      .eq("id", userId)
      .maybeSingle();

    return {
      success: !error,
      data: data ? {
        metadata: data.metadata,
        vip_tier: data.vip_tier
      } : null,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      } : null,
      status,
      timestamp: new Date().toISOString(),
      userId
    };
    };
  });

export const triggerManualSchemaRefresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    
    try {
      const { error } = await supabase.rpc("force_refresh_schema_permissions");
      if (error) throw error;
      
      return { success: true, message: "Comando de recarregamento enviado ao PostgREST." };
    } catch (e: any) {
      console.error("Erro ao disparar refresh manual:", e);
      throw new Error(e.message || "Falha ao disparar refresh");
    }
  });

export const testDatabaseConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("profiles").select("count").limit(1).maybeSingle();
    return { success: !error, data, error: error ? error.message : null };
  });

export const simulateSchemaFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { success: true, message: "Simulação concluída.", error: null };
  });
