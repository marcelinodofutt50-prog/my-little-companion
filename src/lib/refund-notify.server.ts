// Notificação in-app de mudanças de status de reembolso.
// Publica uma mensagem de sistema na conversa de suporte do cliente, que já
// possui realtime + badge de não lidas no painel do cliente.

type Status = "requested" | "approved" | "refunded" | "rejected";

export function refundStatusMessage(status: Status, amountBrl: number, adminNotes?: string | null) {
  const val = amountBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const base: Record<Status, string> = {
    requested: `🧾 Recebemos seu pedido de reembolso de ${val}. Nosso time analisa em até 2 dias.`,
    approved: `✅ Seu reembolso de ${val} foi APROVADO. O estorno será enviado para a chave informada.`,
    refunded: `💸 Seu reembolso de ${val} foi ESTORNADO. Confira sua conta/chave PIX.`,
    rejected: `❌ Seu pedido de reembolso de ${val} foi RECUSADO.`,
  };
  const note = adminNotes?.trim() ? `\n\nObservação do time: ${adminNotes.trim()}` : "";
  return base[status] + note;
}

/** Envia a notificação como mensagem de sistema no suporte do cliente. */
export async function notifyRefundStatus(params: {
  userId: string;
  status: Status;
  amount: number;
  adminNotes?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: thread } = await supabaseAdmin
      .from("support_threads")
      .select("id")
      .eq("user_id", params.userId)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let threadId = (thread as any)?.id as string | undefined;
    if (!threadId) {
      const { data: created } = await supabaseAdmin
        .from("support_threads")
        .insert({ user_id: params.userId, subject: "Reembolso", status: "open" } as any)
        .select("id")
        .single();
      threadId = (created as any)?.id;
    }
    if (!threadId) return;

    await supabaseAdmin.from("support_messages").insert({
      thread_id: threadId,
      sender_id: params.userId,
      is_admin: true,
      is_system: true,
      body: refundStatusMessage(params.status, Number(params.amount), params.adminNotes),
    } as any);
  } catch {
    // Notificação nunca deve derrubar a operação principal de reembolso.
  }
}
