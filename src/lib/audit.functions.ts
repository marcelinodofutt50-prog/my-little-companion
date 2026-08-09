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
    
    // Tabelas críticas mapeadas para auditoria
    const tables = ["tutorials", "tutorial_progress", "integration_logs", "plans", "licenses"];
    const results: Record<string, any> = {};

    for (const table of tables) {
      // Usamos cast para any para contornar limitações do gerador de tipos
      const { error, count } = await (supabaseAdmin.from(table as any) as any)
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

export const getAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Busca logs de integração para o usuário atual (RLS aplicado via supabase client)
    const { data, error } = await (supabase.from("integration_logs" as any) as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[AuditLogs] Erro ao buscar logs:", error);
      return [];
    }

    return (data || []).map((log: any) => ({
      id: log.id,
      event: log.action || "System Event",
      decision: log.outcome === "success" ? "SUCCESS" : "FAILED",
      reason: log.source || "kraken-v2",
      timestamp: log.created_at
    }));
  });

export const triggerEmergencyRepair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    console.log("[EmergencyRepair] Iniciando atualização forçada de permissões...");
    
    try {
      const { error } = await supabaseAdmin.rpc("force_refresh_schema_permissions" as any);
      if (error) throw error;
      
      return { success: true, message: "Esquema e permissões sincronizados com sucesso." };
    } catch (err: any) {
      console.error("[EmergencyRepair] Falha no reparo:", err);
      return { success: false, error: err.message };
    }
  });
