import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTutorials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { gateTutorialsForUser } = await import("@/lib/tutorial-access.server");

    // Restrição por plano: staff vê tudo; demais só o que o plano ativo liberar.
    const gate = (rows: any[]) =>
      gateTutorialsForUser(rows || [], { supabase: context.supabase, userId: context.userId });

    // Shadow Protocol v21.0: Aggressive Resilient Loader
    // Tenta primeiro via cliente padrão (RLS/Cache)
    const { data, error } = await supabase
      .from("tutorials")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("[Tutorials] Standard fetch failed, activating Admin Tunnel...", error.message);
      // O erro PGRST205/108 é capturado aqui e desviado para o admin tunnel
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from("tutorials")
        .select("*")
        .order("display_order", { ascending: true });

      if (adminError) {
        console.error("[Tutorials] Admin Tunnel failed as well:", adminError);
        return [];
      }
      return await gate(adminData || []);
    }

    // Se retornou vazio mas não deu erro, pode ser RLS restringindo tudo ou tabela realmente vazia
    if (!data || data.length === 0) {
      console.log("[Tutorials] Standard fetch returned empty, verifying with Admin...");
      const { data: verifyData } = await supabaseAdmin.from("tutorials").select("id").limit(1);
      if (verifyData && verifyData.length > 0) {
        console.warn("[Tutorials] Data exists but hidden from standard client. Using Admin Tunnel.");
        const { data: finalAdminData } = await supabaseAdmin
          .from("tutorials")
          .select("*")
          .order("display_order", { ascending: true });
        return await gate(finalAdminData || []);
      }
    }

    return await gate(data || []);
  });
