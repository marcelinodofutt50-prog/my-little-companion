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

/**
 * Assina uma mídia do bucket privado `tutorials` para reprodução pelo cliente.
 * O browser não consegue assinar (policies de storage.objects), por isso o
 * service role faz isso aqui — validando que o caminho pertence a um tutorial ativo.
 */
export const signTutorialMedia = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ path: z.string().trim().min(1).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = data.path.replace(/^\/+/, "");
    // Só caminhos simples (sem "..", vírgulas ou parênteses que alterariam o filtro).
    if (!/^[A-Za-z0-9._\-\/]+$/.test(path) || path.includes("..")) {
      return { url: null as string | null };
    }

    const { data: rows } = await supabaseAdmin
      .from("tutorials")
      .select("video_url, image_url")
      .eq("is_active", true)
      .limit(500);
    // O arquivo precisa ser EXATAMENTE a mídia de um tutorial ativo.
    const matches = (u: string | null) =>
      !!u && (u === path || u.endsWith("/" + path) || u.split("?")[0].endsWith("/" + path));
    const owner = (rows ?? []).find((r: any) => matches(r.video_url) || matches(r.image_url));

    if (!owner) return { url: null as string | null };

    const { createDownload } = await import("@/lib/storage-gateway.server");
    try {
      const url = await createDownload("tutorials", path, 60 * 60 * 4);
      return { url: url as string | null };
    } catch (e: any) {
      console.error("[public-tutorials] Falha ao assinar mídia:", { path, message: e?.message });
      return { url: null as string | null };
    }
  });
