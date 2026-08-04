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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        // Reachability probe: any HTTP response (even 404) means the host is up.
        // Yaarsa's root often returns 404 without a valid action param — that's healthy.
        const response = await fetch(baseUrl, {
          method: "GET",
          signal: controller.signal,
          redirect: "manual",
        }).finally(() => clearTimeout(timeoutId));

        const latency = Date.now() - start;
        const reachable = response.status < 500;

        if (reachable) {
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
          message: e.name === "AbortError" ? "Timeout" : "Sem conexão",
          last_checked: new Date().toISOString(),
        });
      }
    });

    await Promise.all(checks);
    
    // Sort to keep order consistent
    return results.sort((a, b) => a.panel.localeCompare(b.panel));
  });
