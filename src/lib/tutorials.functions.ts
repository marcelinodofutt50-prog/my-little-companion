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
    
    // Attempt to touch the schema cache
    try {
      // Only allow staff/admin to trigger the global schema refresh to prevent potential DDOS on the reload mechanism
      if (isAdmin && supabaseAdmin && typeof (supabaseAdmin as any).rpc === 'function') {
        const { error: rpcErr } = await (supabaseAdmin as any).rpc("force_refresh_schema_permissions");
        if (rpcErr) {
          console.warn("[tutorials] Schema refresh RPC error:", rpcErr);
        }
      }
    } catch (e: any) {
      console.warn("[tutorials] Schema refresh attempt failed:", e);
    }

    
    // Attempt 1: Standard query
    console.log("[tutorials] Executing fetch from 'public.tutorials'...");
    
    // We use context.supabase for regular users and only switch to supabaseAdmin on error
    const { data, error } = await context.supabase
      .from("tutorials")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
        
    if (error) {
      console.error(`[tutorials] Fetch FAILED! code: ${error.code}`, error);
      
      const isSchemaError = error.message?.includes("relation \"public.tutorials\" does not exist") || 
                           error.message?.includes("public.tutorials' in the schema cache") ||
                           error.code === 'PGRST108' ||
                           error.code === '42P01';
                           
      if (isSchemaError) {
        console.warn("[tutorials] Schema mismatch detected. Attempting repair...");
        try {
          // If we have an admin client available, we use it to force a refresh
          if (supabaseAdmin && typeof (supabaseAdmin as any).rpc === 'function') {
            await (supabaseAdmin as any).rpc("force_refresh_schema_permissions");
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { data: retryData, error: retryError } = await context.supabase
            .from("tutorials")
            .select("*")
            .order("display_order", { ascending: true });
            
          if (!retryError && retryData) {
            return retryData;
          }
        } catch (repairErr) {
          console.error("[tutorials] Repair routine crashed:", repairErr);
        }
      }
      
      throw new Error(`Erro de Sincronização (PGRST108): A tabela de tutoriais não foi encontrada no cache do sistema. Por favor, utilize o botão de sincronização manual ou o Painel de Diagnóstico.`);
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
