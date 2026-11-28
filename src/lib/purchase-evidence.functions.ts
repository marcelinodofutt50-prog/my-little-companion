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

/**
 * Envio de comprovante SEM pedido interno (ex.: pagamento externo via Cakto na
 * página /obrigado, ou resgate). Reaproveita a mesma tabela/bucket/segurança do
 * fluxo com pedido; order_id fica NULL e aparece na aba admin "Comprovantes".
 */
export const submitStandaloneReceipt = createServerFn({ method:'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown) => z.object({ payerName:z.string().trim().min(3).max(120), filename:z.string().min(1).max(160), base64:z.string().max(Math.ceil(MAX_RECEIPT_BYTES/3)*4) }).parse(v))
  .handler(async ({ data, context }) => {
    const { data:mfa,error:mfaError } = await context.supabase.rpc('mfa_satisfied');
    if (mfaError || !mfa) throw new Error('Confirme a segurança da sua conta antes de enviar.');
    const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    const mime = receiptMime(bytes);
    if (!mime) throw new Error('Envie PNG, JPG ou PDF de até 5 MB.');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2,'0')).join('');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const db = supabaseAdmin as any;
    // Dedup entre comprovantes sem pedido do mesmo usuário.
    const { data:duplicate, error:lookupError } = await db.from('purchase_evidence').select('id').eq('user_id',context.userId).is('order_id',null).eq('sha256',sha256).maybeSingle();
    if (lookupError) throw new Error('Comprovantes indisponíveis agora. Tente novamente.');
    if (duplicate) return { ok:true };
    // Anti-spam: no máximo 10 comprovantes sem pedido por usuário.
    const { count } = await db.from('purchase_evidence').select('id',{count:'exact',head:true}).eq('user_id',context.userId).is('order_id',null).eq('source','customer');
    if ((count ?? 0) >= 10) throw new Error('Você já enviou muitos comprovantes. Fale com o suporte.');
    const { uploadBytes, removeObjects } = await import('./storage-gateway.server');
    const extension = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'pdf';
    const { path } = await uploadBytes('payment-receipts',`${context.userId}/standalone/${crypto.randomUUID()}.${extension}`,bytes,{contentType:mime});
    const { error:insertError } = await db.from('purchase_evidence').insert({ user_id:context.userId,order_id:null,source:'customer',payer_name:data.payerName,filename:data.filename,storage_path:path,storage_bucket:'payment-receipts',mime_type:mime,sha256 });
    if (insertError) {
      await removeObjects('payment-receipts',[path]);
      if (insertError.code === '23505') return { ok:true };
      throw new Error('Não foi possível salvar o comprovante. Tente novamente.');
    }
    return { ok:true };
  });

/**
 * Anexo de comprovante feito pelo ADMIN em nome de um cliente (ex.: no momento
 * de emitir a licença na conversa de suporte). Admin-gated. Grava na mesma
 * tabela/bucket; aparece na aba "Comprovantes" como anexo do suporte, vinculado
 * ao cliente (order_id NULL). Não movimenta dinheiro nem provisiona acesso.
 */
export const adminAttachReceiptForUser = createServerFn({ method:'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown) => z.object({
    userId: z.string().uuid(),
    filename: z.string().trim().min(1).max(160),
    base64: z.string().max(Math.ceil(MAX_RECEIPT_BYTES/3)*4),
    payerName: z.string().trim().max(120).optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import('@/lib/admin-helpers.server');
    await assertStaff(context);
    const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    const mime = receiptMime(bytes);
    if (!mime) throw new Error('Envie PNG, JPG ou PDF de até 5 MB.');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2,'0')).join('');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const db = supabaseAdmin as any;
    const { data:duplicate } = await db.from('purchase_evidence').select('id').eq('user_id',data.userId).eq('sha256',sha256).maybeSingle();
    if (duplicate) return { ok:true, duplicate:true };
    const { uploadBytes, removeObjects } = await import('./storage-gateway.server');
    const extension = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'pdf';
    const { path } = await uploadBytes('payment-receipts',`${data.userId}/admin/${crypto.randomUUID()}.${extension}`,bytes,{contentType:mime});
    const { error:insertError } = await db.from('purchase_evidence').insert({ user_id:data.userId, order_id:null, source:'support', payer_name:data.payerName || null, filename:data.filename, storage_path:path, storage_bucket:'payment-receipts', mime_type:mime, sha256 });
    if (insertError) {
      await removeObjects('payment-receipts',[path]);
      if (insertError.code === '23505') return { ok:true, duplicate:true };
      throw new Error('Não foi possível salvar o comprovante. Tente novamente.');
    }
    return { ok:true };
  });

/**
 * "Bot" de comprovante: usa IA de visão (Gemini) pra dizer se a IMAGEM é mesmo
 * um comprovante de PIX (e não uma foto qualquer / print de tela), extraindo
 * valor, data e ID da transação. Se for recibo de verdade E o anexo veio de uma
 * mensagem de suporte, marca automaticamente como MÍDIA IMPORTANTE no perfil.
 *
 * IMPORTANTE: o veredito é ADVISÓRIO. Nunca aprova pagamento sozinho — só
 * sinaliza pro atendente e eleva o anexo. Admin/staff-gated.
 */
export const analyzeReceiptImage = createServerFn({ method:'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown) => z.object({ id:z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import('@/lib/admin-helpers.server');
    await assertStaff(context);

    const { data:row, error } = await context.supabase.from('purchase_evidence').select('*').eq('id',data.id).maybeSingle();
    if (error || !row) throw new Error('Comprovante não encontrado ou acesso negado.');

    // Resolve caminho/bucket (espelha a lógica do download, inclusive anexos de suporte).
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
    if (!path || !['support-media','payment-receipts'].includes(bucket ?? '')) throw new Error('Este registro não possui arquivo para analisar.');

    const ext = (path ?? '').toLowerCase().split('.').pop() ?? '';
    const mime = (row as any).mime_type
      ?? (ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
    if (mime === 'application/pdf') {
      return { verdict: { isPixReceipt: null as boolean | null, confidence: 0, amountBrl: null, dateText: null, txId: null, payer: null, payee: null, reason: 'Arquivo PDF — a análise automática por IA cobre imagens (PNG/JPG). Confira manualmente.' }, markedImportant: false };
    }

    // Lê os bytes da imagem do storage (service role via gateway). Tenta o
    // projeto certo e, se não responder, cai pro projeto de arquivos (igual ao
    // createDownload), pra arquivo migrado não quebrar a análise.
    const { storageClientFor, filesStorageEnabled, filesAdmin } = await import('./storage-gateway.server');
    const bktName = bucket as string;
    const primary = await storageClientFor(path);
    let blob = (await primary.storage.from(bktName).download(path)).data;
    if (!blob && filesStorageEnabled()) {
      blob = (await filesAdmin().storage.from(bktName).download(path)).data;
    }
    if (!blob) throw new Error('Não foi possível ler a imagem do comprovante.');
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const { generateText } = await import('ai');
    const { withGeminiFallback } = await import('./gemini-provider.server');
    const instrucao = [
      'Você é um verificador de comprovantes de pagamento PIX do Brasil.',
      'Analise a IMAGEM e decida se é um comprovante/recibo de transferência PIX legítimo',
      '(de app de banco, PicPay, Mercado Pago, Nubank, etc.) — e NÃO uma foto qualquer,',
      'print de conversa, print de painel/sistema, meme, selfie ou documento sem valor de pagamento.',
      'Sinais de comprovante PIX: valor em R$, data/hora, nome do pagador e recebedor,',
      'ID/E2E da transação, chave PIX ou instituição.',
      'Responda SOMENTE um JSON válido, sem texto extra, com as chaves:',
      '{"isPixReceipt": boolean, "confidence": number (0 a 1), "amountBrl": number|null,',
      '"dateText": string|null, "txId": string|null, "payer": string|null, "payee": string|null,',
      '"reason": string (curto, em pt-BR, explicando a decisão)}',
    ].join(' ');

    // Base64 data URL: formato aceito por qualquer provedor/SDK (mais robusto
    // que passar o Uint8Array cru pro wrapper do gateway).
    const b64 = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${mime};base64,${b64}`;

    let text = '';
    try {
      const res = await withGeminiFallback((model) => generateText({
        model,
        maxOutputTokens: 800,
        messages: [{ role: 'user', content: [
          { type: 'text', text: instrucao },
          { type: 'image', image: dataUrl },
        ] as any }],
      }));
      text = res.text ?? '';
    } catch (e:any) {
      throw new Error(`A IA não conseguiu analisar agora: ${e?.message ?? 'erro'}`);
    }

    // Extrai o primeiro bloco JSON da resposta.
    const match = text.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    try { parsed = match ? JSON.parse(match[0]) : null; } catch { parsed = null; }

    // Sem JSON válido = a IA não respondeu direito. Veredito NEUTRO (não é
    // "não é comprovante"), pra não dar falso negativo num recibo de verdade.
    if (!parsed || typeof parsed !== 'object') {
      return { verdict: { isPixReceipt: null as boolean | null, confidence: 0, amountBrl: null, dateText: null, txId: null, payer: null, payee: null, reason: 'A IA não retornou um resultado legível. Tente de novo ou confira manualmente.' }, markedImportant: false };
    }

    const num = (v:any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const str = (v:any) => (typeof v === 'string' && v.trim() ? v.trim().slice(0,160) : null);
    const verdict = {
      isPixReceipt: typeof parsed.isPixReceipt === 'boolean' ? parsed.isPixReceipt : false,
      confidence: Math.max(0, Math.min(1, num(parsed.confidence) ?? 0)),
      amountBrl: num(parsed.amountBrl),
      dateText: str(parsed.dateText),
      txId: str(parsed.txId),
      payer: str(parsed.payer),
      payee: str(parsed.payee),
      reason: str(parsed.reason) ?? 'Sem detalhes.',
    };

    // Se for recibo de verdade e o anexo veio de uma mensagem de suporte, marca
    // como mídia importante (mesma tabela do botão manual). Só eleva — nunca aprova.
    let markedImportant = false;
    if (verdict.isPixReceipt && verdict.confidence >= 0.6 && row.source === 'support' && row.source_message_id) {
      const { error:upErr } = await context.supabase
        .from('customer_important_media')
        .upsert({ message_id: row.source_message_id, marked_by: context.userId }, { onConflict: 'message_id', ignoreDuplicates: true });
      if (!upErr) markedImportant = true;
    }

    return { verdict, markedImportant };
  });

export const searchPurchaseEvidence = createServerFn({ method:'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown) => z.object({
    query:z.string().max(100),
    page:z.number().int().min(0).max(1000).default(0),
    source:z.enum(['all','customer','support','mercadopago']).default('all'),
  }).parse(v))
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
    if (data.source !== 'all') query = query.eq('source', data.source);
    const { data:rows,error,count } = await query.order('created_at',{ascending:false}).range(data.page*30,data.page*30+29);
    if (error) throw new Error('Não foi possível pesquisar os comprovantes.');
    // Enriquecimento profissional: e-mail do cliente e plano/valor do pedido,
    // para a equipe identificar a pessoa sem decorar IDs.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const list = (rows ?? []) as any[];
    const userIds: string[] = [...new Set(list.map((r:any) => String(r.user_id)))];
    const orderIds: string[] = [...new Set(list.map((r:any) => r.order_id).filter(Boolean).map(String))];
    const [{ data:profiles }, { data:orders }] = await Promise.all([
      userIds.length ? supabaseAdmin.from('profiles').select('id,email').in('id', userIds) : { data: [] as any[] },
      orderIds.length ? supabaseAdmin.from('orders').select('id,plan_slug,amount,status').in('id', orderIds) : { data: [] as any[] },
    ]);
    const emailById = new Map((profiles ?? []).map((p:any) => [p.id, p.email]));
    const orderById = new Map((orders ?? []).map((o:any) => [o.id, o]));
    const enriched = (rows ?? []).map((r:any) => ({
      ...r,
      customer_email: emailById.get(r.user_id) ?? null,
      order_plan: r.order_id ? (orderById.get(r.order_id)?.plan_slug ?? null) : null,
      order_amount: r.order_id ? (orderById.get(r.order_id)?.amount ?? null) : null,
      order_status: r.order_id ? (orderById.get(r.order_id)?.status ?? null) : null,
    }));
    return { rows:enriched,total:count ?? 0 };
  });

export const getPurchaseEvidenceDownload = createServerFn({ method:'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown) => z.object({ id:z.string().uuid(), inline:z.boolean().optional() }).parse(v))
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
    // inline: link servido sem forçar download, pra visualizar direto no modal
    // (imagem no <img>, PDF no <iframe>). Sem inline, mantém o download de antes.
    const url = await createDownload(bucket ?? 'payment-receipts',path,60,{download:!data.inline});
    // mime pro cliente decidir como renderizar (imagem vs PDF).
    const ext = (path ?? '').toLowerCase().split('.').pop() ?? '';
    const mime = (row as any).mime_type
      ?? (ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'pdf' ? 'application/pdf' : null);
    // Download authorized through RLS before the privileged storage signer is touched.
    if (row.user_id !== context.userId) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { error:auditError } = await supabaseAdmin.from('audit_logs').insert({ user_id:context.userId, system:'purchase_evidence',event:data.inline ? 'preview' : 'download',metadata:{ evidence_id:row.id } });
      if (auditError) throw new Error('Não foi possível registrar a consulta.');
    }
    return { url, mime };
  });

export const organizeSupportEvidence = createServerFn({ method:'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown) => z.object({id:z.string().uuid(),payerName:z.string().trim().min(3).max(120),orderId:z.string().uuid().optional()}).parse(v))
  .handler(async ({data,context}) => {
    const { assertAdminRole } = await import('./roles.server');
    await assertAdminRole(context);
    const {data:row,error} = await context.supabase.from('purchase_evidence').select('user_id,source').eq('id',data.id).maybeSingle();
    if (error || !row || row.source !== 'support') throw new Error('Anexo não encontrado.');
    if (data.orderId) {
      const {data:order} = await context.supabase.from('orders').select('id').eq('id',data.orderId).eq('user_id',row.user_id).maybeSingle();
      if (!order) throw new Error('O pedido deve pertencer ao cliente que enviou o anexo.');
    }
    const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
    const {error:updateError} = await supabaseAdmin.from('purchase_evidence').update({payer_name:data.payerName,...(data.orderId ? {order_id:data.orderId} : {})}).eq('id',data.id).eq('source','support');
    if (updateError) throw new Error('Não foi possível organizar o anexo.');
    await supabaseAdmin.from('audit_logs').insert({user_id:context.userId,system:'purchase_evidence',event:'organize_support_attachment',metadata:{evidence_id:data.id}});
    return {ok:true};
  });