import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/admin-helpers.server";

const MAX_VIDEO = 500 * 1024 * 1024; // 500MB
const MAX_IMAGE = 10 * 1024 * 1024; // 10MB

const VIDEO_EXT = ["mp4", "webm", "mov", "m4v", "mkv", "ogg", "ogv", "avi"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "svg"];

/**
 * Upload de mídia do Centro de Treinamento via URL assinada.
 * O upload direto do browser dependia de policies em storage.objects que
 * variam entre ambientes ("new row violates row-level security policy").
 * Aqui o servidor (service role) valida, registra a causa de qualquer falha
 * e gera o token; o browser apenas envia o arquivo.
 */
export const createTutorialUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        filename: z.string().trim().min(1).max(200),
        kind: z.enum(["video", "image"]),
        size: z.number().int().min(1).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    try {
      await assertStaff(context);
    } catch {
      console.warn("[tutorial-upload] acesso negado para", context.userId);
      throw new Error(
        "Acesso negado: apenas admin ou suporte podem enviar mídia do Centro de Treinamento.",
      );
    }

    const rawExt = (data.filename.split(".").pop() || "").toLowerCase();
    const ext = rawExt.replace(/[^a-z0-9]/g, "").slice(0, 8);
    const allowed = data.kind === "video" ? VIDEO_EXT : IMAGE_EXT;
    if (!ext || !allowed.includes(ext)) {
      throw new Error(
        data.kind === "video"
          ? "Formato de vídeo inválido. Use MP4, WEBM ou MOV."
          : "Formato de imagem inválido. Use JPG, PNG, WEBP, GIF ou SVG.",
      );
    }

    const limit = data.kind === "video" ? MAX_VIDEO : MAX_IMAGE;
    if (data.size && data.size > limit) {
      throw new Error(
        `Arquivo maior que o limite (${Math.round(limit / 1024 / 1024)}MB). Comprima e tente novamente.`,
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${context.userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket("tutorials");
    if (bucketError || !bucket) {
      console.error("[tutorial-upload] bucket indisponível:", {
        userId: context.userId,
        code: (bucketError as { statusCode?: string })?.statusCode,
        message: bucketError?.message,
      });
      throw new Error(
        "O armazenamento do Centro de Treinamento não está disponível neste ambiente. Tente novamente em alguns minutos.",
      );
    }

    const { data: signed, error } = await supabaseAdmin.storage
      .from("tutorials")
      .createSignedUploadUrl(path);

    if (error || !signed) {
      // Causa registrada no servidor para diagnóstico; usuário recebe texto claro.
      console.error("[tutorial-upload] createSignedUploadUrl falhou:", {
        userId: context.userId,
        kind: data.kind,
        path,
        message: error?.message,
      });
      if (/bucket not found/i.test(error?.message ?? "")) {
        throw new Error(
          "O espaço de armazenamento dos tutoriais não existe neste ambiente. Avise o suporte técnico.",
        );
      }
      throw new Error(`Falha ao preparar o envio: ${error?.message ?? "sem resposta do storage"}`);
    }

    console.log("[tutorial-upload] token emitido", { userId: context.userId, path });
    return { path, token: signed.token, mediaPath: path };
  });

/**
 * URL assinada de leitura para pré-visualizar a mídia recém-enviada.
 * O bucket `tutorials` é privado: gerar a URL no browser depende de policies
 * em storage.objects que variam por ambiente e falhava com "não foi possível
 * preparar a visualização". Aqui o service role assina e devolve pronto.
 */
export const createTutorialPreviewUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ path: z.string().trim().min(1).max(400) }).parse(i))
  .handler(async ({ data, context }) => {
    try {
      await assertStaff(context);
    } catch {
      throw new Error("Acesso negado: apenas admin ou suporte podem visualizar essa mídia.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("tutorials")
      .createSignedUrl(data.path, 60 * 60);
    if (error || !signed?.signedUrl) {
      console.error("[tutorial-upload] preview falhou:", { path: data.path, message: error?.message });
      return { url: null as string | null };
    }
    return { url: signed.signedUrl };
  });
