import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Upload de avatar server-side (Shadow Identity v2).
 * O upload direto pelo browser dependia de policies de storage que variam entre
 * ambientes e resultava em "new row violates row-level security policy".
 * Aqui o arquivo é gravado pelo servidor, sempre dentro da pasta do próprio
 * usuário (<user_id>/...), e a URL é persistida no perfil.
 */
export const uploadAvatar = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        dataUrl: z.string().min(10),
        contentType: z.string().min(3).max(100),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(data.contentType)) {
      throw new Error("Formato inválido. Use PNG, JPG, WEBP ou GIF.");
    }

    const base64 = data.dataUrl.includes(",") ? data.dataUrl.split(",")[1]! : data.dataUrl;
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 2 * 1024 * 1024) throw new Error("Imagem muito pesada (máx 2MB).");

    const ext = data.contentType.split("/")[1]!.replace("jpeg", "jpg");
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, bytes, { contentType: data.contentType, upsert: true, cacheControl: "3600" });

    if (upErr) throw new Error("Falha no upload: " + upErr.message);

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);

    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", userId)
      .maybeSingle();

    const metadata = {
      ...(((current?.metadata as any) || {}) as object),
      avatar_url: publicUrl,
      avatar_updated_at: new Date().toISOString(),
    };

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ metadata, avatar_url: publicUrl })
      .eq("id", userId);

    if (profErr) throw new Error("Upload feito, mas o perfil não atualizou: " + profErr.message);

    return { ok: true, url: publicUrl };
  });
