import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Módulo de Auditoria Forense e Reparo Ativo (Shadow Core v5.1)
 * Este arquivo contém funções táticas para garantir a integridade do banco
 * e o funcionamento dos sistemas críticos em produção.
 */

export const getAuditSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Verificar tabelas críticas
    const tables = ["tutorials", "tutorial_progress", "integration_logs", "plans", "licenses"];
    const results: Record<string, any> = {};

    for (const table of tables) {
      const { error, count } = await (supabaseAdmin.from(table) as any)
        .select("*", { count: "exact", head: true });
      results[table] = { 
        status: error ? "ERROR" : "OK", 
        count: count ?? 0,
        error: error?.message 
      };
    }

    return {
      timestamp: new Date().toISOString(),
      database: results,
      environment: process.env.NODE_ENV || "production"
    };
  });

export const triggerEmergencyRepair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    console.log("[EmergencyRepair] Iniciando atualização forçada de permissões...");
    
    try {
      const { error } = await supabaseAdmin.rpc("force_refresh_schema_permissions");
      if (error) throw error;
      
      return { success: true, message: "Esquema e permissões sincronizados com sucesso." };
    } catch (err: any) {
      console.error("[EmergencyRepair] Falha no reparo:", err);
      return { success: false, error: err.message };
    }
  });
