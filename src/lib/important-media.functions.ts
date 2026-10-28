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
    const THREAD_LIMIT = 500, ROW_LIMIT = 200, GROUP_SIZE = 80;
    let threadIds: string[] = [];
    let threadsTruncated = false;
    if (data.threadId) {
      const { data: t } = await db.from("support_threads").select("id").eq("id", data.threadId).maybeSingle();
      if (!t) throw new Error("Conversa não encontrada");
      threadIds = [t.id];
    } else if (data.userId) {
      const { data: ts, error } = await db.from("support_threads").select("id").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(THREAD_LIMIT + 1);
      if (error) throw new Error("Não foi possível carregar as mídias importantes.");
      threadsTruncated = (ts ?? []).length > THREAD_LIMIT;
      threadIds = (ts ?? []).slice(0, THREAD_LIMIT).map((t: any) => t.id);
    }
    if (threadIds.length === 0) return { items: [], truncated: false };
    const { chunkIds, mergeBookmarkRows, toSignedImportantMediaItems } = await import("./important-media");
    const groups: any[][] = [];
    for (const group of chunkIds(threadIds, GROUP_SIZE)) {
      const { data: rows, error } = await db
        .from("customer_important_media")
        .select("message_id, marked_at, support_messages!inner(id, thread_id, attachment_url, attachment_type, created_at, is_admin, sender_id)")
        .in("support_messages.thread_id", group)
        .order("marked_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (error) throw new Error("Não foi possível carregar as mídias importantes.");
      groups.push(rows ?? []);
    }
    const merged = mergeBookmarkRows(groups, ROW_LIMIT);
    const rows = merged.rows;
    const { SUPPORT_MEDIA_BUCKET, SUPPORT_MEDIA_SIGNED_TTL, extractSupportMediaPath } = await import("./support-media");
    const { canAttachSupportMedia } = await import("./support-attachment-access");
    // Only canonical storage keys owned by the conversation (or staff) may be signed.
    const pathFor = (row: any): string | null => {
      const m = row.support_messages;
      const path = extractSupportMediaPath(m?.attachment_url);
      return m && path && canAttachSupportMedia(path, m.thread_id, m.sender_id, true) ? path : null;
    };
    const paths = Array.from(new Set(rows.map(pathFor).filter((p: string | null): p is string => !!p)));
    let signed: Record<string, string> = {};
    if (paths.length) {
      try {
        const { createDownloads } = await import("@/lib/storage-gateway.server");
        signed = await createDownloads(SUPPORT_MEDIA_BUCKET, paths, SUPPORT_MEDIA_SIGNED_TTL);
      } catch {
        // Fail closed: never fall back to the stored link.
        throw new Error("Não foi possível carregar as mídias importantes.");
      }
    }
    return { items: toSignedImportantMediaItems(rows as any, threadIds, pathFor, signed), truncated: merged.truncated || threadsTruncated };
  });
