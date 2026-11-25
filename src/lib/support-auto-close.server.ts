import { SUPPORT_IDLE_MS } from "./support-renewal-rules";

/** Só um pagamento iniciado nas últimas 48h segura o ticket aberto. Pedidos
 *  'pending' antigos (checkout abandonado) não devem travar o auto-close. */
const PAYMENT_GUARD_MS = 48 * 60 * 60 * 1000;

/** Bounded scan; all eligibility checks fail closed and retain the thread snapshot guard. */
export async function runSupportAutoClose(db: any, now = Date.now()) {
  const cutoff = new Date(now - SUPPORT_IDLE_MS).toISOString();
  const stats = { checked: 0, closed: 0, pendingPayment: 0, recentActivity: 0, readFailures: 0, changed: 0, noticeFailures: 0, truncated: false };
  const candidates: any[] = [];
  // Collect before mutating, so closing a row cannot shift offset pagination.
  for (let page = 0; page < 10; page++) {
    const { data, error } = await db.from("support_threads")
      .select("id,user_id,updated_at,created_at,last_customer_message_at,last_staff_message_at")
      .neq("status", "closed").lte("updated_at", cutoff)
      .order("updated_at", { ascending: true }).order("id", { ascending: true })
      .range(page * 500, page * 500 + 499);
    if (error) throw new Error("Não foi possível verificar os atendimentos.");
    candidates.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
    if (page === 9) stats.truncated = true;
  }
  for (const t of candidates) {
    stats.checked++;
    const stamps = [t.updated_at, t.created_at, t.last_customer_message_at, t.last_staff_message_at]
      .filter(Boolean).map((v) => Date.parse(v));
    if (!stamps.length || stamps.some((v) => !Number.isFinite(v)) || Math.max(...stamps) > now - SUPPORT_IDLE_MS) {
      stats.recentActivity++; continue;
    }
    // Só pagamentos RECENTES seguram o ticket (cliente ativo no meio da compra).
    // Antes, um único pedido 'pending' antigo e abandonado travava TODOS os tickets
    // daquele cliente pra sempre — por isso quase nada fechava (pendingPayment ~= checked).
    const paymentCutoff = new Date(now - PAYMENT_GUARD_MS).toISOString();
    const [latest, orders, crypto] = await Promise.all([
      db.from("support_messages").select("created_at").eq("thread_id", t.id)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1),
      db.from("orders").select("id").eq("user_id", t.user_id)
        .in("status", ["pending", "created", "processing", "yaarsa_failed"])
        .gte("created_at", paymentCutoff).limit(1),
      db.from("crypto_payments").select("id").eq("user_id", t.user_id)
        .in("status", ["pending", "confirmed", "failed"])
        .gte("created_at", paymentCutoff).limit(1),
    ]);
    if (latest.error || orders.error || crypto.error) { stats.readFailures++; continue; }
    if (orders.data?.length || crypto.data?.length) { stats.pendingPayment++; continue; }
    const latestMessage = latest.data?.[0];
    if (latestMessage) {
      const lastMessageAt = Date.parse(latestMessage.created_at);
      if (!Number.isFinite(lastMessageAt) || lastMessageAt > now - SUPPORT_IDLE_MS) {
        stats.recentActivity++; continue;
      }
    }
    const { data: updated, error } = await db.from("support_threads").update({
      status: "closed", closed_at: new Date(now).toISOString(),
      closed_by_name: "Sistema (inatividade)", unread_by_staff: 0,
    }).eq("id", t.id).neq("status", "closed").eq("updated_at", t.updated_at).select("id").maybeSingle();
    if (error) { stats.readFailures++; continue; }
    if (!updated) { stats.changed++; continue; }
    stats.closed++;
    const { error: noticeError } = await db.from("support_messages").insert({
      thread_id: t.id, sender_id: t.user_id, is_admin: true, is_system: true,
      body: "Atendimento encerrado após 5h sem atividade. Se ainda precisar de ajuda, envie uma nova mensagem.",
    });
    if (noticeError) stats.noticeFailures++;
  }
  return stats;
}