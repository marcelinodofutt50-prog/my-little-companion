import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTutorials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Tenta busca simples primeiro
    const { data, error } = await supabase
      .from("tutorials")
      .select("*")
      .order("display_order", { ascending: true });

<<<<<<< HEAD
    if (!error) {
      return data || [];
    }

    console.error("[Tutorials] Erro no acesso:", error);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isSchemaError =
      error.code === "PGRST108" ||
      error.code === "PGRST205" ||
      error.message?.includes("schema cache") ||
      error.message?.includes("does not exist") ||
      error.code === "42703" ||
      error.code === "42P01";

    if (isSchemaError) {
      try {
        await supabaseAdmin.rpc("force_refresh_schema_permissions");
        await new Promise((resolve) => setTimeout(resolve, 1200));
      } catch (refreshError) {
        console.warn("[Tutorials] Refresh schema falhou:", refreshError);
      }
    }

    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("tutorials")
      .select("*")
      .order("display_order", { ascending: true });

    if (adminError) {
      console.error("[Tutorials] Admin fallback failed:", adminError);
      return [];
    }

    return adminData || [];
=======
    if (error) {
      console.error("[Tutorials] Erro no acesso:", error);
      // Fallback para admin/reparo se falhar
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: adminData } = await supabaseAdmin
        .from("tutorials")
        .select("*")
        .order("display_order", { ascending: true });
      return adminData || [];
    }
    return data || [];
>>>>>>> origin/main
  });
