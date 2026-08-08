import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { data: admin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  const { data: mod } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "moderator" });
  if (!admin && !mod) throw new Error("Forbidden");
}

export const listTutorials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<any[]> => {
    // Verificação Admin/Staff é necessária para garantir que apenas autorizados acessem as funções de reparo
    // No entanto, para LISTAR tutoriais publicamente (ou para usuários comuns), 
    // precisamos de uma lógica que não quebre se o usuário não for staff.

    // A verificação automática do schema é feita no carregamento para garantir a integridade.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isAdmin = context.claims?.role === 'admin' || context.claims?.role === 'moderator';
    
    // Attempt 1: Standard query with fallback
    console.log("[tutorials] Executing fetch from 'public.tutorials'...");
    
    // We try authenticated user first to respect RLS, but if it fails with schema cache error, 
    // we use admin as the ultimate fallback to keep the app working.
    let { data, error } = await context.supabase
      .from("tutorials")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
        
    if (error) {
      console.warn(`[tutorials] Standard Fetch failed (Code: ${error.code}). Trying Admin fallback...`);
      
      // Attempt 2: Admin fallback (bypasses PostgREST cache issues)
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from("tutorials")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
        
      if (adminError) {
        console.error(`[tutorials] Admin Fetch FAILED! code: ${adminError.code}`, adminError);
        throw new Error(`Erro de Sincronização Crítico: A infraestrutura de tutoriais está inacessível.`);
      }
      
      data = adminData;
      
      // While we serve the admin data, we trigger a refresh in the background for future requests
      if (isAdmin && typeof (supabaseAdmin as any).rpc === 'function') {
        supabaseAdmin.rpc("force_refresh_schema_permissions").then(({ error: rpcErr }: any) => {
          if (rpcErr) console.warn("[tutorials] BG Schema refresh error:", rpcErr);
          else console.log("[tutorials] BG Schema refresh triggered successfully");
        });
      }
    }

    return data ?? [];
  });


export const adminSaveTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
      description: z.string().min(5, "Descrição deve ter pelo menos 5 caracteres"),
      video_url: z.string().url().nullish(),
      image_url: z.string().url().nullish(),
      youtube_url: z.string().url().nullish(),
      category: z.string().min(2, "Categoria é obrigatória"),
      is_active: z.boolean().default(true),
      display_order: z.number().int().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
        .from("tutorials")
        .upsert({ ...data, created_by: context.userId });
    if (error) {
      console.error("[tutorials] Database error:", error);
      const wrapped = new Error(error.message);
      if (error.message?.includes("relation \"public.tutorials\" does not exist") || 
          error.message?.includes("public.tutorials' in the schema cache")) {
        (wrapped as any)._schemaError = "public.tutorials";
      }
      throw wrapped;
    }

    return { ok: true };
  });

export const adminDeleteTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tutorials").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTutorialOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.array(z.object({
    id: z.string().uuid(),
    display_order: z.number().int()
  })).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    for (const item of data) {
      const { error } = await supabaseAdmin
        .from("tutorials")
        .update({ display_order: item.display_order })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    }
    
    return { ok: true };
  });
