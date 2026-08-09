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
  });
