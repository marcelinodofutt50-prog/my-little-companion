import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDiagnosticData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    // Tentamos buscar explicitamente as colunas para testar o cache do PostgREST
    const { data, error, status } = await supabase
      .from("profiles")
      .select("metadata, vip_tier")
      .eq("id", userId)
      .maybeSingle();

    return {
      success: !error,
      data: data || null,
      error: error || null,
      status,
      timestamp: new Date().toISOString(),
      userId
    };
  });

export const triggerManualSchemaRefresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    
    try {
      // Tenta forçar o recarregamento do schema
      const { error } = await supabase.rpc("force_refresh_schema_permissions");
      if (error) throw error;
      
      return { success: true, message: "Comando de recarregamento enviado ao PostgREST." };
    } catch (e: any) {
      console.error("Erro ao disparar refresh manual:", e);
      throw new Error(e.message || "Falha ao disparar refresh");
    }
  });
