import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/admin-helpers.server";

export async function trackSchemaFailure(
  error: any, 
  context: string, 
  recovered = false, 
  metadata: any = {},
  userId?: string
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const route = metadata.route || "unknown_route";

    console.warn(`[tracking] Registrando falha de sincronização (${error.code || 'ERR'}):`, error.message);

    await (supabaseAdmin.from("integration_logs") as any).insert({
      source: "shadow-core-db",
      user_id: userId,
      action: "pgrst108_sync_error",
      outcome: recovered ? "recovered" : "failure",
      error: error.message || String(error),
      context: {
        error_code: error.code || "UNKNOWN",
        location: context,
        recovered,
        route,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    });

    // Gatilho de reparo imediato no backend se detectarmos falha de esquema
    if (error.code === 'PGRST108' || error.message?.includes('schema cache') || error.code === '42P01') {
      console.log("[tracking] Acionando reparo de esquema via RPC...");
      try {
        await supabaseAdmin.rpc("force_refresh_schema_permissions");
        // Toque tático agressivo para invalidar caches de borda
        await supabaseAdmin.from("tutorial_progress").select("*").limit(1).maybeSingle();
        await supabaseAdmin.from("tutorials").select("*").limit(1).maybeSingle();
      } catch (e) {
        console.error("[tracking] Repair cycle failed:", e);
      }
    }
  } catch (e) {
    console.error("[tracking] Failed to log failure:", e);
  }
}

export const listTutorials = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({
    metadata: z.object({
      route: z.string().optional(),
      force_repair: z.boolean().optional()
    }).optional()
  }).optional().parse(d || {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data: input, context }): Promise<any[]> => {
    // Listagem administrativa (inclui inativos/restritos via service role): só staff.
    await assertStaff(context);
    const metadata = input?.metadata || {};

    const fetchWithRetry = async (attempt = 1): Promise<any[]> => {
      const timestamp = new Date().toISOString();
      console.log(`[tutorials] [${timestamp}] [DEBUG] Busca de módulos (Tentativa ${attempt})...`);
      
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      
      if (input?.metadata?.force_repair) {
        console.warn(`[tutorials] [${timestamp}] [RECOVERY] Reparo forçado solicitado.`);
        await supabaseAdmin.rpc("force_refresh_schema_permissions");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const { data: clientData, error: clientError, status, statusText } = await supabaseAdmin
        .from("tutorials")
        .select("*")
        .order("display_order", { ascending: true });
          
      if (clientError) {
        console.error(`[tutorials] [${timestamp}] [ERROR] Falha na busca:`, {
          code: clientError.code,
          message: clientError.message,
          http_status: status,
          http_text: statusText
        });

        const isPGRST = clientError.code === 'PGRST108' || 
                        clientError.message?.includes('schema cache') || 
                        clientError.code === '42P01' ||
                        clientError.code === '42703';
        
        if (isPGRST && attempt <= 3) {
          console.warn(`[tutorials] [${timestamp}] [RECOVERY] Erro de schema. Tentando reparo (${attempt}/3)...`);
          await supabaseAdmin.rpc("force_refresh_schema_permissions");
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
          return fetchWithRetry(attempt + 1);
        }
        return [];
      }

      const results = (clientData || []).filter(item => item && item.id && (item.title || item.category));
      console.log(`[tutorials] [${timestamp}] [SUCCESS] Cliente retornou ${results.length} módulos.`);
      return results;
    };

    return await fetchWithRetry();
  });

export const adminSaveTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const emptyToNull = z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(1000).refine(
        (value) => /^https?:\/\//i.test(value) || /^[a-zA-Z0-9_./-]+$/.test(value),
        "Informe uma URL válida ou um arquivo do Centro de Treinamento.",
      ).nullish(),
    );
    return z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(3),
      description: z.string().min(5),
      video_url: emptyToNull,
      image_url: emptyToNull,
      youtube_url: emptyToNull,
      category: z.string().min(2),
      is_active: z.boolean().default(true),
      display_order: z.number().int().optional(),
      // Restrição por plano: vazio/ausente = público; senão só esses plan_slug.
      allowed_plans: z.array(z.string().trim().min(1).max(80)).max(60).optional().nullable(),
    }).parse(input);
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, any> = { ...data, created_by: context.userId };
    if (!payload.id) delete payload.id;
    // Normaliza: array vazio vira NULL (público) e remove duplicados.
    payload.allowed_plans = Array.isArray(data.allowed_plans) && data.allowed_plans.length
      ? Array.from(new Set(data.allowed_plans.map((s) => s.trim()).filter(Boolean)))
      : null;
    const { error } = await supabaseAdmin
        .from("tutorials")
        .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return { ok: true };
  });


export const adminDeleteTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Pega a mídia antes de apagar a linha, pra limpar o bucket depois.
    const { data: row } = await supabaseAdmin
      .from("tutorials")
      .select("video_url, image_url")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("tutorials").delete().eq("id", data.id);
    if (error) throw error;

    // Limpeza best-effort da mídia órfã no bucket privado — nunca derruba a exclusão.
    try {
      const toPath = (u: any): string | null => {
        if (typeof u !== "string" || !u.trim()) return null;
        let p = u.trim().replace(/^\/+/, "").split("?")[0];
        const m = p.match(/\/tutorials\/(.+)$/);
        if (m) p = m[1];
        return p || null;
      };
      const paths = [toPath((row as any)?.video_url), toPath((row as any)?.image_url)].filter(
        (p): p is string => !!p,
      );
      if (paths.length) await supabaseAdmin.storage.from("tutorials").remove(paths);
    } catch (e) {
      console.warn("[tutorials] limpeza de mídia órfã falhou (ignorado):", e);
    }
    return { ok: true };
  });

export const updateTutorialOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.array(z.object({
    id: z.string().uuid(),
    display_order: z.number().int()
  })).max(1000).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Agora falha em voz alta: qualquer update que erra lança, e o cliente reverte
    // a ordem (antes ignorava o erro e devolvia "ok" com ordem parcialmente salva).
    for (const item of data) {
      const { error } = await supabaseAdmin
        .from("tutorials")
        .update({ display_order: item.display_order })
        .eq("id", item.id);
      if (error) throw new Error(`Falha ao salvar a ordem: ${error.message}`);
    }
    return { ok: true };
  });
