import type { MpPayment } from './mercadopago.server';

/** Only provider-returned fields; never a full response or bank identity document. */
export async function recordProviderEvidence(db: any, orderId: string, payment: MpPayment) {
  if (payment.external_reference !== orderId && payment.metadata?.['orderId'] !== orderId) return;
  const { data: order, error } = await db.from('orders').select('id,user_id,mp_payment_id,amount').eq('id',orderId).maybeSingle();
  if (error || !order || String(order.mp_payment_id) !== String(payment.id) || !Number.isFinite(Number(payment.transaction_amount)) || Number(payment.transaction_amount) < Number(order.amount) - 0.01) return;
  const name = [payment.payer?.first_name, payment.payer?.last_name].filter(Boolean).join(' ').trim().slice(0,120) || null;
  const result = await db.from('purchase_evidence').upsert({
    user_id:order.user_id, order_id:orderId, source:'mercadopago',
    provider_payment_id:String(payment.id), payer_name:name,
    payment_status:payment.status, amount:payment.transaction_amount,
    currency:payment.currency_id ?? 'BRL', approved_at:payment.date_approved ?? null,
  }, { onConflict:'provider_payment_id' });
  if (result.error) throw new Error('Não foi possível registrar a confirmação do provedor.');
}