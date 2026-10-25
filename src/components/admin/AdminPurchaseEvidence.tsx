import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Download, Loader2, Search, HandCoins, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPurchaseEvidenceDownload, searchPurchaseEvidence, organizeSupportEvidence } from '@/lib/purchase-evidence.functions';
import { listPlansForManualPayment, listCustomerLicensesForManualPayment, listManualPayments, registerManualPayment } from '@/lib/manual-payment.functions';

type Evidence = { id:string; order_id:string | null; user_id:string; payer_name:string | null; source:string; provider_payment_id:string | null; payment_status:string | null; amount:number | null; filename:string | null; storage_path:string | null; source_message_id:string | null; created_at:string; customer_email:string | null; order_plan:string | null; order_amount:number | null; order_status:string | null };
type Plan = { slug:string; name:string; price_brl:number; category:string };
type LicenseOption = { id:string; plan_slug:string; yaarsa_email:string; server_paid_until:string | null };

const SOURCE_LABELS: Record<string,string> = { all:'Todos', customer:'Enviados pelo cliente', support:'Anexos do suporte', mercadopago:'Mercado Pago' };

function ManualPaymentPanel({ prefillEmail, prefillEvidenceId, onDone }: { prefillEmail?:string; prefillEvidenceId?:string; onDone:() => void }) {
  const [email,setEmail] = useState(prefillEmail ?? '');
  const [plans,setPlans] = useState<Plan[]>([]);
  const [planSlug,setPlanSlug] = useState('');
  const [licenses,setLicenses] = useState<LicenseOption[]>([]);
  const [licenseId,setLicenseId] = useState('');
  const [note,setNote] = useState('');
  const [loadingPlans,setLoadingPlans] = useState(true);
  const [loadingLicenses,setLoadingLicenses] = useState(false);
  const [submitting,setSubmitting] = useState(false);
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const loadPlans = useServerFn(listPlansForManualPayment);
  const loadLicenses = useServerFn(listCustomerLicensesForManualPayment);
  const register = useServerFn(registerManualPayment);

  useEffect(() => {
    let active = true;
    loadPlans().then(r => { if(active) setPlans(r.plans as Plan[]); }).catch(() => { if(active) setError('Não foi possível carregar os planos.'); }).finally(() => { if(active) setLoadingPlans(false); });
    return () => { active = false; };
  }, [loadPlans]);

  const selectedPlan = plans.find(p => p.slug === planSlug) ?? null;

  useEffect(() => {
    if (!selectedPlan || selectedPlan.category !== 'server' || !email.includes('@')) { setLicenses([]); setLicenseId(''); return; }
    let active = true; setLoadingLicenses(true);
    loadLicenses({ data:{ customerEmail: email } })
      .then(r => { if(active) setLicenses(r.licenses as LicenseOption[]); })
      .catch(() => { if(active) setLicenses([]); })
      .finally(() => { if(active) setLoadingLicenses(false); });
    return () => { active = false; };
  }, [loadLicenses, selectedPlan, email]);

  return <form className="space-y-3 rounded-md border border-border p-4" data-sensitive onSubmit={async e => {
    e.preventDefault(); setSubmitting(true); setError(''); setSuccess('');
    try {
      const r = await register({ data:{ customerEmail:email, planSlug, ...(licenseId ? { targetLicenseId:licenseId } : {}), ...(prefillEvidenceId ? { evidenceId:prefillEvidenceId } : {}), ...(note ? { note } : {}) } });
      setSuccess(r.delivered ? 'Pagamento registrado e acesso entregue automaticamente.' : `Pagamento registrado; entrega em nova tentativa automática (${r.reason ?? 'pendente'}).`);
      onDone();
    } catch (err:any) { setError(err?.message ?? 'Não foi possível registrar.'); }
    finally { setSubmitting(false); }
  }}>
    <h3 className="font-medium">Registrar pagamento feito por fora (PIX no chat)</h3>
    <p className="text-xs text-muted-foreground">Cria o pedido com o preço oficial e entrega o acesso automaticamente — licença nova ou renovação do login escolhido. Tudo fica registrado na auditoria.</p>
    <label className="block text-xs">E-mail da conta do cliente no site
      <Input required type="email" maxLength={255} value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@exemplo.com" />
    </label>
    <label className="block text-xs">Plano pago
      <select required className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={planSlug} onChange={e => { setPlanSlug(e.target.value); setLicenseId(''); }} disabled={loadingPlans}>
        <option value="">Selecione…</option>
        {plans.map(p => <option key={p.slug} value={p.slug}>{p.name} — R$ {Number(p.price_brl).toFixed(2)}</option>)}
      </select>
    </label>
    {selectedPlan?.category === 'server' && <label className="block text-xs">Login do cliente que será renovado
      <select required className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={licenseId} onChange={e => setLicenseId(e.target.value)} disabled={loadingLicenses}>
        <option value="">{loadingLicenses ? 'Carregando logins…' : 'Selecione…'}</option>
        {licenses.map(l => <option key={l.id} value={l.id}>{l.yaarsa_email} · {l.plan_slug}</option>)}
      </select>
    </label>}
    <label className="block text-xs">Observação interna (opcional)
      <Input maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Ex.: PIX enviado no chat do suporte em 24/10" />
    </label>
    {prefillEvidenceId && <p className="text-xs text-muted-foreground">O anexo selecionado será vinculado ao pedido criado.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {success && <p role="status" className="text-sm text-green-500">{success}</p>}
    <Button type="submit" disabled={submitting || !planSlug}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <HandCoins className="mr-2 h-4 w-4"/>}Registrar e entregar</Button>
  </form>;
}

function ManualPaymentsHistory() {
  const [rows,setRows] = useState<{ id:string; customer_email:string | null; plan_slug:string; amount:number; status:string; created_at:string; paid_at:string | null; note:string | null }[]>([]);
  const [total,setTotal] = useState(0);
  const [page,setPage] = useState(0);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const list = useServerFn(listManualPayments);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    list({ data:{ page } }).then(r => { if(active){ setRows(r.rows); setTotal(r.total); } }).catch(() => { if(active) setError('Não foi possível carregar o histórico.'); }).finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, [list,page]);
  return <section className="space-y-2">
    <h3 className="flex items-center gap-2 font-medium"><History className="h-4 w-4"/>Pagamentos registrados por fora</h3>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <Loader2 className="h-5 w-5 animate-spin"/> : <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
      {rows.map(r => <article key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm" data-sensitive>
        <div className="min-w-0"><p className="font-medium">{r.customer_email ?? 'Cliente não identificado'}</p><p className="text-xs text-muted-foreground">{r.plan_slug} · R$ {Number(r.amount).toFixed(2)} · {new Date(r.created_at).toLocaleString('pt-BR')}{r.note ? ` · ${r.note}` : ''}</p></div>
        <span className={`text-xs ${r.status === 'paid' ? 'text-green-500' : 'text-amber-500'}`}>{r.status === 'paid' ? 'Entregue' : 'Entrega pendente'}</span>
      </article>)}
    </div>}
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><Button size="sm" variant="outline" disabled={page===0 || loading} onClick={() => setPage(v => v-1)}>Anterior</Button><span>{total} registros · página {page+1}</span><Button size="sm" variant="outline" disabled={(page+1)*20 >= total || loading} onClick={() => setPage(v => v+1)}>Próxima</Button></div>
  </section>;
}

export function AdminPurchaseEvidence() {
  const [query,setQuery] = useState('');
  const [term,setTerm] = useState('');
  const [source,setSource] = useState<'all'|'customer'|'support'|'mercadopago'>('all');
  const [page,setPage] = useState(0);
  const [result,setResult] = useState<{rows:Evidence[];total:number}>({rows:[],total:0});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [downloading,setDownloading] = useState<string | null>(null);
  const [showManual,setShowManual] = useState(false);
  const [manualPrefill,setManualPrefill] = useState<{email?:string;evidenceId?:string}>({});
  const search = useServerFn(searchPurchaseEvidence);
  const download = useServerFn(getPurchaseEvidenceDownload);
  const organize = useServerFn(organizeSupportEvidence);
  const [editing,setEditing] = useState<string | null>(null);
  const [payer,setPayer] = useState('');
  const [order,setOrder] = useState('');
  const [saving,setSaving] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    search({data:{query:term,page,source}}).then(r => { if(active) setResult(r as any); }).catch(() => {if(active) setError('Não foi possível carregar. Tente novamente.');}).finally(() => {if(active) setLoading(false);});
    return () => { active=false; };
  }, [search,term,page,source]);
  return <section className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-xl font-semibold">Comprovantes e pagamentos</h2><p className="mt-1 text-sm text-muted-foreground">Documentos privados para atendimento de pagamentos e contestações. Um anexo não confirma pagamento ou fraude.</p></div>
      <Button variant="outline" onClick={() => { setManualPrefill({}); setShowManual(v => !v); }}><HandCoins className="mr-2 h-4 w-4"/>{showManual ? 'Fechar registro' : 'Registrar pagamento por fora'}</Button>
    </header>
    {showManual && <ManualPaymentPanel prefillEmail={manualPrefill.email} prefillEvidenceId={manualPrefill.evidenceId} onDone={() => { setPage(0); setTerm(term => term); }} />}
    <form className="flex gap-2" onSubmit={e => {e.preventDefault();setPage(0);setTerm(query);}}><Input aria-label="Pesquisar comprovantes" placeholder="Nome do pagador, ID completo do pedido/cliente ou pagamento" value={query} onChange={e => setQuery(e.target.value)} maxLength={100}/><Button type="submit" disabled={loading}><Search className="mr-2 h-4 w-4" />Buscar</Button></form>
    <div className="flex flex-wrap gap-2">{(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map(key => <Button key={key} size="sm" variant={source === key ? 'default' : 'outline'} onClick={() => { setSource(key); setPage(0); }}>{SOURCE_LABELS[key]}</Button>)}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="space-y-2">{result.rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>}{result.rows.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4" data-sensitive>
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{row.payer_name ?? 'Pagador não informado'}</p>
        <p className="text-xs text-muted-foreground">{row.source === 'mercadopago' ? 'Dados retornados pelo Mercado Pago' : row.source === 'support' ? 'Anexo do suporte · não verificado' : 'Comprovante enviado · nome declarado pelo cliente'}</p>
        <p className="break-all text-xs">Cliente: {row.customer_email ?? row.user_id}</p>
        {row.order_id && <p className="break-all font-mono text-xs">Pedido: {row.order_id}{row.order_plan ? ` · ${row.order_plan} · R$ ${Number(row.order_amount ?? 0).toFixed(2)} · ${row.order_status}` : ''}</p>}
        {!row.order_id && <p className="text-xs text-amber-500">Sem vínculo com pedido — consultar cliente</p>}
        <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString('pt-BR')}{row.provider_payment_id ? ` · Pagamento ${row.provider_payment_id} · ${row.payment_status}` : ''}</p>
        {row.filename && <p className="break-all text-xs">{row.filename}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {(row.storage_path || row.source_message_id) && <Button size="sm" variant="outline" disabled={!!downloading} onClick={async () => {setDownloading(row.id);setError('');try {const {url} = await download({data:{id:row.id}});window.open(url,'_blank','noopener,noreferrer');}catch{setError('Não foi possível baixar este anexo.');}finally{setDownloading(null);}}}>{downloading === row.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}Baixar</Button>}
        {row.source === 'support' && <Button size="sm" variant="ghost" onClick={() => {setEditing(row.id);setPayer(row.payer_name ?? '');setOrder(row.order_id ?? '');}}>Organizar anexo</Button>}
        {!row.order_id && row.customer_email && <Button size="sm" variant="ghost" onClick={() => { setManualPrefill({ email:row.customer_email!, evidenceId:row.id }); setShowManual(true); }}>Registrar pagamento</Button>}
      </div>
      {editing === row.id && <form className="w-full space-y-2" onSubmit={async e => {e.preventDefault();setSaving(true);setError('');try {await organize({data:{id:row.id,payerName:payer,...(order ? {orderId:order} : {})}});setResult(r => ({...r,rows:r.rows.map(item => item.id === row.id ? {...item,payer_name:payer,order_id:order || item.order_id} : item)}));setEditing(null);}catch{setError('Confira o nome e o ID de um pedido deste cliente.');}finally{setSaving(false);}}}><label className="block text-xs">Nome lido pela equipe no comprovante<Input required minLength={3} maxLength={120} value={payer} onChange={e => setPayer(e.target.value)}/></label><label className="block text-xs">ID completo do pedido (opcional)<Input value={order} onChange={e => setOrder(e.target.value)} /></label><div className="flex gap-2"><Button size="sm" disabled={saving} type="submit">Salvar</Button><Button size="sm" variant="ghost" type="button" disabled={saving} onClick={() => setEditing(null)}>Cancelar</Button></div></form>}
    </article>)}</div>}
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><Button size="sm" variant="outline" disabled={page===0 || loading} onClick={() => setPage(v => v-1)}>Anterior</Button><span>{result.total} registros · página {page+1}</span><Button size="sm" variant="outline" disabled={(page+1)*30 >= result.total || loading} onClick={() => setPage(v => v+1)}>Próxima</Button></div>
    <ManualPaymentsHistory />
  </section>;
}
