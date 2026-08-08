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
    // A verificação automática do schema é feita no carregamento para garantir a integridade.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Fallback agressivo: Tentamos "tocar" as tabelas para forçar o carregamento do schema
    // se o RPC falhar ou se o cache estiver muito teimoso.
    try {
      console.log("[tutorials] Performing tactical table touch...");
      await Promise.allSettled([
        supabaseAdmin.from("tutorials").select("id").limit(1),
        supabaseAdmin.from("tutorial_progress").select("id").limit(1),
        supabaseAdmin.rpc("force_refresh_schema_permissions")
      ]);
    } catch (e) {
      console.warn("[tutorials] Table touch/sync skipped:", e);
    }
    
    // Attempt 1: Standard query
    console.log("[tutorials] Executing fetch from 'public.tutorials'...");
    
    // Bypass: Tentamos forçar o reload do schema no PostgREST ANTES da leitura principal
    // para garantir que ele esteja atualizado com as permissões aplicadas na migração.
    try {
      await supabaseAdmin.rpc("notify_pgrst_reload");
    } catch (e) {
      console.warn("[tutorials] Pre-fetch reload failed:", e);
    }

    const { data, error, status, statusText } = await supabaseAdmin
      .from("tutorials")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
        
    if (error) {
      console.error(`[tutorials] Fetch FAILED! Status: ${status} (${statusText})`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      const isSchemaError = error.message?.includes("relation \"public.tutorials\" does not exist") || 
                           error.message?.includes("public.tutorials' in the schema cache") ||
                           error.code === 'PGRST108' ||
                           error.code === '42P01';
                           
      if (isSchemaError) {
        console.warn("[tutorials] Schema cache mismatch detected. Triggering AGGRESSIVE server-side repair...");
        try {
          const repairStart = Date.now();
          // Chamada à nova função SECURITY DEFINER que garante permissões e reload
          await supabaseAdmin.rpc("force_refresh_schema_permissions");
          
          console.log("[tutorials] Repair signal sent. Waiting 2000ms for PostgREST propagation...");
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log("[tutorials] Retrying fetch after repair...");
          const { data: retryData, error: retryError } = await supabaseAdmin
            .from("tutorials")
            .select("*")
            .eq("is_active", true)
            .order("display_order", { ascending: true });
            
          if (!retryError && retryData) {
            console.log(`[tutorials] Repair SUCCESSFUL! Retrieved ${retryData.length} items.`);
            return retryData;
          }
          if (retryError) console.error("[tutorials] Retry also FAILED:", retryError);
        } catch (repairErr) {
          console.error("[tutorials] Server-side repair routine crashed:", repairErr);
        }
      }
      
      throw new Error(`Erro de Sincronização (PGRST108): ${error.message}. Detalhes: ${error.hint || 'Nenhum'}`);
    }

    console.log(`[tutorials] Fetch successful. Returned ${data?.length} tutorials.`);
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
