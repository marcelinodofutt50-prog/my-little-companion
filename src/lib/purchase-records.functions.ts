import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-helpers.server";
import { purchaseRecordInputSchema, type PurchaseRecordItem } from "@/lib/purchase-records";

const MAX_RECORDS = 100;
const MAX_CANDIDATES = 30;

/** Assina só anexos com chave canônica pertencente à conversa; falha fechada, nunca devolve o link guardado. */
async function signAttachments(
  rows: { id: string; thread_id: string; attachment_url: string | null; sender_id: string | null }[],
): Promise<Map<string, string>> {
  const { SUPPORT_MEDIA_BUCKET, SUPPORT_MEDIA_SIGNED_TTL, extractSupportMediaPath } = await import("./support-media");
  const { canAttachSupportMedia } = await import("./support-attachment-access");
  const pathByMessage = new Map<string, string>();
  for (const r of rows) {
    const p = extractSupportMediaPath(r.attachment_url);
    if (p && canAttachSupportMedia(p, r.thread_id, r.sender_id ?? "", true)) pathByMessage.set(r.id, p);
  }
  const out = new Map<string, string>();
  const paths = Array.from(new Set(pathByMessage.values()));
  if (!paths.length) return out;
  const { createDownloads } = await import("@/lib/storage-gateway.server");
  const signed = await createDownloads(SUPPORT_MEDIA_BUCKET, paths, SUPPORT_MEDIA_SIGNED_TTL);
  for (const [id, p] of pathByMessage) if (signed[p]) out.set(id, signed[p]);
  return out;
}

/** Lista a ficha privada de compras e notas de um cliente (admin + 2FA). */
export const adminListPurchaseRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("customer_purchase_records")
      .select("id, kind, title, note, amount, purchased_on, created_at, receipt_message_id")
      .eq("customer_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(MAX_RECORDS + 1);
    if (error) throw new Error("Não foi possível carregar a ficha de compras.");
    const list = (rows ?? []).slice(0, MAX_RECORDS);
    const ids = list.map((r) => r.receipt_message_id).filter((x): x is string => !!x);
    let msgs: any[] = [];
    if (ids.length) {
      const { data: m, error: mErr } = await context.supabase
        .from("support_messages").select("id, thread_id, attachment_url, attachment_type, sender_id").in("id", ids);
      if (mErr) throw new Error("Não foi possível carregar os comprovantes.");
      msgs = m ?? [];
    }
    let signed = new Map<string, string>();
    try { signed = await signAttachments(msgs); } catch { /* comprovante fica indisponível, sem link antigo */ }
    const byId = new Map(msgs.map((m) => [m.id as string, m]));
    const items: PurchaseRecordItem[] = list.map((r) => ({
      id: r.id,
      kind: r.kind as PurchaseRecordItem["kind"],
      title: r.title,
      note: r.note,
      amount: r.amount == null ? null : Number(r.amount),
      purchasedOn: r.purchased_on,
      createdAt: r.created_at,
      receipt: r.receipt_message_id
        ? { messageId: r.receipt_message_id, url: signed.get(r.receipt_message_id) ?? null, type: byId.get(r.receipt_message_id)?.attachment_type ?? null }
        : null,
    }));
    return { items, truncated: (rows ?? []).length > MAX_RECORDS };
  });

/** Anexos recentes das conversas do cliente, para escolher o comprovante. */
export const adminListReceiptCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: threads, error } = await context.supabase
      .from("support_threads").select("id").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("Não foi possível carregar os anexos do cliente.");
    const threadIds = (threads ?? []).map((t) => t.id);
    if (!threadIds.length) return { items: [] as { messageId: string; url: string; type: string | null; sentAt: string }[] };
    const { data: msgs, error: mErr } = await context.supabase
      .from("support_messages")
      .select("id, thread_id, attachment_url, attachment_type, sender_id, created_at")
      .in("thread_id", threadIds)
      .not("attachment_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(MAX_CANDIDATES);
    if (mErr) throw new Error("Não foi possível carregar os anexos do cliente.");
    const rows = msgs ?? [];
    let signed: Map<string, string>;
    try { signed = await signAttachments(rows); } catch { throw new Error("Não foi possível carregar os anexos do cliente."); }
    return {
      items: rows.flatMap((m) => {
        const url = signed.get(m.id);
        return url ? [{ messageId: m.id, url, type: m.attachment_type, sentAt: m.created_at }] : [];
      }),
    };
  });

/** Registra compra ou nota manual. Não concede benefício, licença nem aprova pagamento. */
export const adminAddPurchaseRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => purchaseRecordInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: profile } = await context.supabase.from("profiles").select("id").eq("id", data.userId).maybeSingle();
    if (!profile) throw new Error("Cliente não encontrado.");
    const { data: row, error } = await context.supabase
      .from("customer_purchase_records")
      .insert({
        customer_id: data.userId,
        kind: data.kind,
        title: data.kind === "purchase" ? data.title ?? null : null,
        note: data.note ?? null,
        amount: data.kind === "purchase" ? data.amount ?? null : null,
        purchased_on: data.purchasedOn ?? null,
        receipt_message_id: data.receiptMessageId ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23514") throw new Error("O comprovante precisa ser um anexo de uma conversa deste cliente.");
      throw new Error("Não foi possível salvar o registro.");
    }
    return { ok: true, id: row.id };
  });

export const adminDeletePurchaseRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: deleted, error } = await context.supabase
      .from("customer_purchase_records").delete().eq("id", data.id).select("id");
    if (error) throw new Error("Não foi possível remover o registro.");
    if (!deleted?.length) throw new Error("Registro não encontrado.");
    return { ok: true };
  });
