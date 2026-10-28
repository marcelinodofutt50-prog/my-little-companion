import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-helpers.server";

/** Marca/desmarca um anexo do chat como importante (somente admin com 2FA; RLS reforça). */
export const adminSetImportantMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ messageId: z.string().uuid(), important: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.important) {
      const { error } = await context.supabase.from("customer_important_media").delete().eq("message_id", data.messageId);
      if (error) throw new Error("Não foi possível remover o destaque.");
      return { ok: true, important: false };
    }
    const { data: msg } = await context.supabase
      .from("support_messages").select("id, attachment_url").eq("id", data.messageId).maybeSingle();
    if (!msg?.attachment_url) throw new Error("Esta mensagem não tem mídia.");
    const { error } = await context.supabase
      .from("customer_important_media")
      .upsert({ message_id: data.messageId, marked_by: context.userId }, { onConflict: "message_id", ignoreDuplicates: true });
    if (error) throw new Error("Não foi possível marcar a mídia como importante.");
    return { ok: true, important: true };
  });

/** Lista mídias importantes de uma conversa ou de todo o histórico de um cliente. */
export const adminListImportantMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ threadId: z.string().uuid().optional(), userId: z.string().uuid().optional() })
      .refine((v) => Number(!!v.threadId) + Number(!!v.userId) === 1, { message: "Informe uma conversa ou um cliente." })
      .parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { pickAdminClient } = await import("./admin-read.server");
    const { db } = await pickAdminClient(context.supabase);
    let threadIds: string[] = [];
    if (data.threadId) {
      const { data: t } = await db.from("support_threads").select("id").eq("id", data.threadId).maybeSingle();
      if (!t) throw new Error("Conversa não encontrada");
      threadIds = [t.id];
    } else if (data.userId) {
      const { data: ts, error } = await db.from("support_threads").select("id").eq("user_id", data.userId).limit(500);
      if (error) throw new Error("Não foi possível carregar as mídias importantes.");
      threadIds = (ts ?? []).map((t: any) => t.id);
    }
    if (threadIds.length === 0) return { items: [] };
    const { data: rows, error } = await db
      .from("customer_important_media")
      .select("message_id, marked_at, support_messages!inner(id, thread_id, attachment_url, attachment_type, created_at, is_admin, sender_id)")
      .in("support_messages.thread_id", threadIds)
      .order("marked_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Não foi possível carregar as mídias importantes.");
    const { toImportantMediaItems } = await import("./important-media");
    const items = toImportantMediaItems((rows ?? []) as any, threadIds);
    const { SUPPORT_MEDIA_BUCKET, SUPPORT_MEDIA_SIGNED_TTL, extractSupportMediaPath } = await import("./support-media");
    const { canAttachSupportMedia } = await import("./support-attachment-access");
    const safePaths = new Map<string, string>();
    for (const row of rows ?? []) {
      const m = row.support_messages;
      const path = extractSupportMediaPath(m?.attachment_url);
      if (m && path && canAttachSupportMedia(path, m.thread_id, m.sender_id, true)) safePaths.set(row.message_id, path);
    }
    const paths = Array.from(new Set(safePaths.values()));
    if (paths.length) {
      try {
        const { createDownloads } = await import("@/lib/storage-gateway.server");
        const signed = await createDownloads(SUPPORT_MEDIA_BUCKET, paths, SUPPORT_MEDIA_SIGNED_TTL);
        for (const item of items) {
          const p = safePaths.get(item.messageId);
          if (p && signed[p]) item.attachmentUrl = signed[p];
        }
      } catch { /* mantém links existentes */ }
    }
    return { items };
  });
