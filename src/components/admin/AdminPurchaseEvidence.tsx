import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Download, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPurchaseEvidenceDownload, searchPurchaseEvidence, organizeSupportEvidence } from '@/lib/purchase-evidence.functions';

type Evidence = { id:string; order_id:string | null; user_id:string; payer_name:string | null; source:string; provider_payment_id:string | null; payment_status:string | null; amount:number | null; filename:string | null; storage_path:string | null; source_message_id:string | null; created_at:string };
export function AdminPurchaseEvidence() {
  const [query,setQuery] = useState('');
  const [term,setTerm] = useState('');
  const [page,setPage] = useState(0);
  const [result,setResult] = useState<{rows:Evidence[];total:number}>({rows:[],total:0});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [downloading,setDownloading] = useState<string | null>(null);
  const search = useServerFn(searchPurchaseEvidence);
  const download = useServerFn(getPurchaseEvidenceDownload);
  const organize = useServerFn(organizeSupportEvidence);
  const [editing,setEditing] = useState<string | null>(null);
  const [payer,setPayer] = useState('');
  const [order,setOrder] = useState('');
  const [saving,setSaving] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    search({data:{query:term,page}}).then(r => { if(active) setResult(r); }).catch(() => {if(active) setError('Não foi possível carregar. Tente novamente.');}).finally(() => {if(active) setLoading(false);});
    return () => { active=false; };
  }, [search,term,page]);
  return <section className="space-y-4">
    <header><h2 className="text-xl font-semibold">Comprovantes e pagamentos</h2><p className="mt-1 text-sm text-muted-foreground">Documentos privados para atendimento de pagamentos e contestações. Um anexo não confirma pagamento ou fraude.</p></header>
    <form className="flex gap-2" onSubmit={e => {e.preventDefault();setPage(0);setTerm(query);}}><Input aria-label="Pesquisar comprovantes" placeholder="Nome do pagador, ID completo do pedido/cliente ou pagamento" value={query} onChange={e => setQuery(e.target.value)} maxLength={100}/><Button type="submit" disabled={loading}><Search className="mr-2 h-4 w-4" />Buscar</Button></form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="space-y-2">{result.rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>}{result.rows.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4" data-sensitive>
      <div className="min-w-0 space-y-1"><p className="font-medium">{row.payer_name ?? 'Pagador não informado'}</p><p className="text-xs text-muted-foreground">{row.source === 'mercadopago' ? 'Dados retornados pelo Mercado Pago' : row.source === 'support' ? 'Anexo do suporte · não verificado' : 'Comprovante enviado · nome declarado pelo cliente'}</p><p className="break-all font-mono text-xs">Pedido: {row.order_id ?? 'Sem vínculo — consultar cliente'}<br/>Cliente: {row.user_id}</p><p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString('pt-BR')}{row.provider_payment_id ? ` · Pagamento ${row.provider_payment_id} · ${row.payment_status}` : ''}</p>{row.filename && <p className="break-all text-xs">{row.filename}</p>}</div>
      {(row.storage_path || row.source_message_id) && <Button size="sm" variant="outline" disabled={!!downloading} onClick={async () => {setDownloading(row.id);setError('');try {const {url} = await download({data:{id:row.id}});window.open(url,'_blank','noopener,noreferrer');}catch{setError('Não foi possível baixar este anexo.');}finally{setDownloading(null);}}}>{downloading === row.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}Baixar</Button>}
      {row.source === 'support' && <Button size="sm" variant="ghost" onClick={() => {setEditing(row.id);setPayer(row.payer_name ?? '');setOrder(row.order_id ?? '');}}>Organizar anexo</Button>}
      {editing === row.id && <form className="w-full space-y-2" onSubmit={async e => {e.preventDefault();setSaving(true);setError('');try {await organize({data:{id:row.id,payerName:payer,...(order ? {orderId:order} : {})}});setResult(r => ({...r,rows:r.rows.map(item => item.id === row.id ? {...item,payer_name:payer,order_id:order || item.order_id} : item)}));setEditing(null);}catch{setError('Confira o nome e o ID de um pedido deste cliente.');}finally{setSaving(false);}}}><label className="block text-xs">Nome lido pela equipe no comprovante<Input required minLength={3} maxLength={120} value={payer} onChange={e => setPayer(e.target.value)}/></label><label className="block text-xs">ID completo do pedido (opcional)<Input value={order} onChange={e => setOrder(e.target.value)} /></label><div className="flex gap-2"><Button size="sm" disabled={saving} type="submit">Salvar</Button><Button size="sm" variant="ghost" type="button" disabled={saving} onClick={() => setEditing(null)}>Cancelar</Button></div></form>}
    </article>)}</div>}
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><Button size="sm" variant="outline" disabled={page===0 || loading} onClick={() => setPage(v => v-1)}>Anterior</Button><span>{result.total} registros · página {page+1}</span><Button size="sm" variant="outline" disabled={(page+1)*30 >= result.total || loading} onClick={() => setPage(v => v+1)}>Próxima</Button></div>
  </section>;
}