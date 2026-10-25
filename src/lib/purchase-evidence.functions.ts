import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { canAttachReceipt, evidenceSearch, MAX_RECEIPT_BYTES, receiptMime } from './purchase-evidence-rules';

export const submitPurchaseReceipt = createServerFn({ method:'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown) => z.object({ orderId:z.string().uuid(), payerName:z.string().trim().min(3).max(120), filename:z.string().min(1).max(160), base64:z.string().max(Math.ceil(MAX_RECEIPT_BYTES/3)*4) }).parse(v))
  .handler(async ({ data, context }) => {
    const { data:mfa,error:mfaError } = await context.supabase.rpc('mfa_satisfied');
    if (mfaError || !mfa) throw new Error('Confirme a segurança da sua conta antes de enviar.');
    const { data:order, error } = await context.supabase.from('orders').select('user_id,status,paid_at').eq('id',data.orderId).eq('user_id',context.userId).maybeSingle();
    if (error || !canAttachReceipt(order,context.userId)) throw new Error('Selecione uma compra com pagamento confirmado.');
    const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    const mime = receiptMime(bytes);
    if (!mime) throw new Error('Envie PNG, JPG ou PDF de até 5 MB.');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2,'0')).join('');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const db = supabaseAdmin as any;
    const { data:duplicate, error:lookupError } = await db.from('purchase_evidence').select('id').eq('order_id',data.orderId).eq('sha256',sha256).maybeSingle();
    if (lookupError) throw new Error('Comprovantes indisponíveis agora. Tente novamente.');
    if (duplicate) return { ok:true };
    const { count } = await db.from('purchase_evidence').select('id',{count:'exact',head:true}).eq('order_id',data.orderId).eq('source','customer');
    if ((count ?? 0) >= 5) throw new Error('Este pedido já possui 5 comprovantes.');
    const { uploadBytes, removeObjects } = await import('./storage-gateway.server');
    const extension = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'pdf';
    const { path } = await uploadBytes('payment-receipts',`${context.userId}/${data.orderId}/${crypto.randomUUID()}.${extension}`,bytes,{contentType:mime});
    const { error:insertError } = await db.from('purchase_evidence').insert({ user_id:context.userId,order_id:data.orderId,source:'customer',payer_name:data.payerName,filename:data.filename,storage_path:path,storage_bucket:'payment-receipts',mime_type:mime,sha256 });
    if (insertError) {
      await removeObjects('payment-receipts',[path]);
      if (insertError.code === '23505') return { ok:true };
      throw new Error('Não foi possível salvar o comprovante. Tente novamente.');
    }
    return { ok:true };
  });

export const searchPurchaseEvidence = createServerFn({ method:'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown) => z.object({ query:z.string().max(100), page:z.number().int().min(0).max(1000).default(0) }).parse(v))
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import('./roles.server');
    await assertAdminRole(context);
    let query = (context.supabase as any).from('purchase_evidence').select('id,user_id,order_id,source,payer_name,provider_payment_id,payment_status,amount,currency,approved_at,filename,storage_path,source_message_id,created_at',{count:'exact'});
    const term = evidenceSearch(data.query);
    if (term) {
      const filters = [`payer_name.ilike.%${term}%`,`provider_payment_id.ilike.%${term}%`];
      if (z.string().uuid().safeParse(term).success) filters.push(`order_id.eq.${term}`,`user_id.eq.${term}`);
      query = query.or(filters.join(','));
    }
    const { data:rows,error,count } = await query.order('created_at',{ascending:false}).range(data.page*30,data.page*30+29);
    if (error) throw new Error('Não foi possível pesquisar os comprovantes.');
    return { rows:rows ?? [],total:count ?? 0 };
  });

export const getPurchaseEvidenceDownload = createServerFn({ method:'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown) => z.object({ id:z.string().uuid() }).parse(v))
  .handler(async ({ data,context }) => {
    const { data:row,error } = await context.supabase.from('purchase_evidence').select('*').eq('id',data.id).maybeSingle();
    if (error || !row) throw new Error('Comprovante não encontrado ou acesso negado.');
    let path = row.storage_path;
    let bucket = row.storage_bucket;
    if (row.source === 'support' && row.source_message_id) {
      const { data:message } = await context.supabase.from('support_messages').select('attachment_url,thread_id,sender_id').eq('id',row.source_message_id).maybeSingle();
      const { extractSupportMediaPath } = await import('./support-media');
      path = extractSupportMediaPath(message?.attachment_url);
      bucket = 'support-media';
      const raw = path?.replace(/^s2\//,'');
      if (!message || message.sender_id !== row.user_id || !raw?.startsWith(`${row.user_id}/${message.thread_id}/`) || raw.includes('..')) throw new Error('Anexo não pode ser vinculado com segurança.');
    }
    if (!path || !['support-media','payment-receipts'].includes(bucket ?? '')) throw new Error('Este registro não possui arquivo bancário.');
    const { createDownload } = await import('./storage-gateway.server');
    const url = await createDownload(bucket ?? 'payment-receipts',path,60,{download:true});
    // Download authorized through RLS before the privileged storage signer is touched.
    if (row.user_id !== context.userId) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { error:auditError } = await supabaseAdmin.from('audit_logs').insert({ user_id:context.userId, system:'purchase_evidence',event:'download',metadata:{ evidence_id:row.id } });
      if (auditError) throw new Error('Não foi possível registrar a consulta.');
    }
    return { url };
  });