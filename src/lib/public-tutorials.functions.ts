import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listPublicTutorials = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(12),
    category: z.string().optional(),
    difficulty: z.string().optional(),
    search: z.string().optional(),
    orderBy: z.enum(["created_at", "title"]).default("created_at"),
    orderDir: z.enum(["asc", "desc"]).default("desc")
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Auto-repair schema if needed
    try {
      console.log("[public-tutorials] Pre-flight schema check...");
      await supabaseAdmin.rpc("force_refresh_schema_permissions");
    } catch (e) {
      console.warn("[public-tutorials] Pre-fetch schema refresh skipped:", e);
    }

    let query = supabaseAdmin
      .from("tutorials")
      .select("*", { count: "exact" })
      .eq("is_active", true);

    if (data.category && data.category !== "Tudo") {
      query = query.eq("category", data.category);
    }
    
    if (data.search) {
      query = query.or(`title.ilike.%${data.search}%,description.ilike.%${data.search}%`);
    }

    const from = (data.page - 1) * data.limit;
    const to = from + data.limit - 1;

    query = query
      .order(data.orderBy, { ascending: data.orderDir === "asc" })
      .range(from, to);

    const { data: tutorials, error, count, status, statusText } = await query;

    if (error) {
      console.error(`[public-tutorials] List FAILED! Status: ${status} (${statusText})`, {
        code: error.code,
        message: error.message,
        details: error.details
      });
      
      const isSchemaError = error.message?.includes("schema cache") || 
                           error.message?.includes("does not exist") ||
                           error.code === 'PGRST108';
                           
      if (isSchemaError) {
        console.warn("[public-tutorials] Schema cache issue detected. Attempting recovery...");
        try {
          await supabaseAdmin.rpc("force_refresh_schema_permissions");
          await new Promise(r => setTimeout(r, 1000));
          const { data: retryData, error: retryError, count: retryCount } = await query;
          if (!retryError) {
            return {
              items: retryData ?? [],
              total: retryCount ?? 0,
              page: data.page,
              limit: data.limit
            };
          }
        } catch (repairErr) {
          console.error("[public-tutorials] Recovery failed:", repairErr);
        }
      }
      
      throw new Error(`Erro ao listar tutoriais: ${error.message} (${error.code})`);
    }

    return {
      items: tutorials ?? [],
      total: count ?? 0,
      page: data.page,
      limit: data.limit
    };
  });

export const getPublicTutorialById = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: tutorial, error } = await supabaseAdmin
      .from("tutorials")
      .select("*")
      .eq("id", data.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!tutorial) throw new Error("Tutorial não encontrado");

    return tutorial;
  });
