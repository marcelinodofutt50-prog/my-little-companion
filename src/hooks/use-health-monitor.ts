import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { performHealthCheck } from "@/lib/health.functions";
import { supabase } from "@/integrations/supabase/client";

export type HealthStatus = "healthy" | "degraded" | "critical" | "loading";

export interface SystemHealth {
  overall: HealthStatus;
  database: HealthStatus;
  support: HealthStatus;
  playProtect: HealthStatus;
  theme: HealthStatus;
  modules: HealthStatus;
  lastCheck: string;
  errors: string[];
}

export function useHealthMonitor() {
  const checkFn = useServerFn(performHealthCheck);
  const [health, setHealth] = useState<SystemHealth>({
    overall: "loading",
    database: "loading",
    support: "loading",
    playProtect: "loading",
    theme: "healthy",
    modules: "healthy",
    lastCheck: new Date().toISOString(),
    errors: [],
  });

  const runCheck = useCallback(async () => {
    const errors: string[] = [];
    let dbStatus: HealthStatus = "healthy";
    let supportStatus: HealthStatus = "healthy";
    let ppStatus: HealthStatus = "healthy";
    let modStatus: HealthStatus = "healthy";
    let themeStatus: HealthStatus = "healthy";

    try {
      // 1. Server-side check
      const serverResult = await checkFn();
      if (serverResult.database.status !== "healthy") {
        dbStatus = serverResult.database.status;
        errors.push(`DB: ${serverResult.database.message}`);
      }

      if (!serverResult.tables.support_threads.accessible || !serverResult.tables.support_messages.accessible) {
        supportStatus = "degraded";
        errors.push("Suporte: Tabelas de mensagens ou threads inacessíveis");
      }

      if (!serverResult.tables.apk_build_jobs.accessible) {
        ppStatus = "degraded";
        errors.push("Play Protect: Tabela de jobs inacessível");
      }

      // 2. Client-side checks
      // Check for theme consistency (hydration vs preference)
      const savedTheme = localStorage.getItem("shadow-theme");
      const currentTheme = document.documentElement.classList.contains("theme-light") ? "light" : "dark";
      if (savedTheme && savedTheme !== "system" && savedTheme !== currentTheme) {
        themeStatus = "degraded";
        errors.push("Tema: Inconsistência entre preferência e renderização");
      }

      // Check for module/chunk load errors (via global indicator if possible)
      // For now we assume if the app is running, it's ok, but we could hook into window errors
      
      // Calculate overall
      const statuses = [dbStatus, supportStatus, ppStatus, themeStatus, modStatus];
      let overall: HealthStatus = "healthy";
      if (statuses.includes("critical")) overall = "critical";
      else if (statuses.includes("degraded")) overall = "degraded";

      setHealth({
        overall,
        database: dbStatus,
        support: supportStatus,
        playProtect: ppStatus,
        theme: themeStatus,
        modules: modStatus,
        lastCheck: new Date().toISOString(),
        errors,
      });
    } catch (e: any) {
      setHealth(prev => ({
        ...prev,
        overall: "critical",
        database: "critical",
        errors: [...prev.errors, `Check failed: ${e.message}`],
        lastCheck: new Date().toISOString(),
      }));
    }
  }, [checkFn]);

  useEffect(() => {
    runCheck();
    const timer = setInterval(runCheck, 60000); // Every minute
    
    // Listen for module errors
    const handleErr = (e: ErrorEvent) => {
      if (e.message?.toLowerCase().includes("failed to fetch dynamically imported module") || 
          e.message?.toLowerCase().includes("chunkloaderror")) {
        setHealth(prev => ({
          ...prev,
          overall: "degraded",
          modules: "critical",
          errors: [...prev.errors, "Falha ao carregar módulo do sistema"],
        }));
      }
    };
    window.addEventListener("error", handleErr);

    return () => {
      clearInterval(timer);
      window.removeEventListener("error", handleErr);
    };
  }, [runCheck]);

  return { health, refetch: runCheck };
}
