import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/admin-helpers.server";

/**
 * Upload de mídia do Centro de Treinamento via URL assinada.
 * O upload direto do browser dependia de policies em storage.objects que
 * variam entre ambientes ("new row violates row-level security policy").
 * Aqui o servidor (service role) gera o token e o browser envia o arquivo.
 */
export const createTutorialUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        filename: z.string().trim().min(1).max(200),
        kind: z.enum(["video", "image"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ext = (data.filename.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
    const path = `tutorials/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data: signed, error } = await supabaseAdmin.storage
      .from("tutorials")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Falha ao preparar upload");

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("tutorials").getPublicUrl(path);

    return { path, token: signed.token, publicUrl };
  });
