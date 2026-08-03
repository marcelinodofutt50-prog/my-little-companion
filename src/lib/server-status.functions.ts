import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_PANELS, panelBaseUrl, yaarsaEndpointsFor, sanitizeAdminKey } from "./yaarsa.server";

export type ServerStatus = {
  panel: string;
  host: string;
  status: "online" | "offline" | "error";
  latency_ms: number | null;
  message?: string;
  last_checked: string;
};

export const getServerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ServerStatus[]> => {
    const results: ServerStatus[] = [];
    
    // We check in parallel
    const checks = ALL_PANELS.map(async (panel) => {
      const baseUrl = panelBaseUrl(panel);
      const host = baseUrl.replace(/^https?:\/\//i, "").split("/")[0];
      const start = Date.now();
      
      try {
        const endpoints = yaarsaEndpointsFor(baseUrl);
        // We just do a HEAD or a small GET to the proxy to see if it's alive
        // Since we don't want to trigger actions, we send a junk request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(endpoints[0], {
          method: "GET",
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const latency = Date.now() - start;
        
        // Yaarsa usually returns 200 even for some errors, but if it's 404 or 500 it's definitely bad
        if (response.ok) {
          results.push({
            panel,
            host,
            status: "online",
            latency_ms: latency,
            last_checked: new Date().toISOString(),
          });
        } else {
          results.push({
            panel,
            host,
            status: "error",
            latency_ms: latency,
            message: `HTTP ${response.status}`,
            last_checked: new Date().toISOString(),
          });
        }
      } catch (e: any) {
        results.push({
          panel,
          host,
          status: "offline",
          latency_ms: null,
          message: e.name === "AbortError" ? "Timeout" : "Connection failed",
          last_checked: new Date().toISOString(),
        });
      }
    });

    await Promise.all(checks);
    
    // Sort to keep order consistent
    return results.sort((a, b) => a.panel.localeCompare(b.panel));
  });
