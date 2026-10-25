import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { CheckCircle2, Loader2, Paperclip, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitPurchaseReceipt } from '@/lib/purchase-evidence.functions';
import { MAX_RECEIPT_BYTES } from '@/lib/purchase-evidence-rules';

export function PurchaseReceiptForm({ orderId, compact=false }: { orderId:string; compact?:boolean }) {
  const [open,setOpen] = useState(!compact);
  const [name,setName] = useState('');
  const [file,setFile] = useState<File | null>(null);
  const [busy,setBusy] = useState(false);
  const [sent,setSent] = useState(false);
  const [error,setError] = useState('');
  const submit = useServerFn(submitPurchaseReceipt);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Paperclip className="mr-2 h-4 w-4" />Enviar comprovante</Button>;
  if (sent) return <p role="status" className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />Comprovante enviado à equipe.</p>;
  return <form className="space-y-3 py-4 text-left" onSubmit={async e => {
    e.preventDefault();
    if (!file || busy) return;
    if (file.size > MAX_RECEIPT_BYTES || file.size === 0) return setError('Envie um arquivo de até 5 MB.');
    setBusy(true); setError('');
    try {
      const base64 = await new Promise<string>((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await submit({data:{orderId,payerName:name,filename:file.name,base64}});
      setSent(true);
    } catch { setError('Não foi possível enviar. Confira o arquivo e tente novamente; sua compra não será afetada.'); }
    finally { setBusy(false); }
  }}>
    <h2 className="text-sm font-semibold">Gostaria de enviar o comprovante à nossa equipe?</h2>
    <p className="text-xs leading-5 text-muted-foreground">Ele é importante para localizar seu pagamento e ajudar em eventuais dúvidas. O envio é opcional e não altera a liberação da compra.</p>
    <label className="block text-xs">Nome do pagador no comprovante<Input data-sensitive value={name} onChange={e => setName(e.target.value)} required minLength={3} maxLength={120} className="mt-1" autoComplete="name" /></label>
    <label className="block text-xs">Comprovante PIX — JPG, PNG ou PDF, até 5 MB<Input type="file" accept="image/jpeg,image/png,application/pdf" required onChange={e => setFile(e.target.files?.[0] ?? null)} className="mt-1" /></label>
    <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3 w-3 shrink-0" />Privado: não aparece para outros clientes.</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy || !file || name.trim().length < 3}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}Enviar à equipe</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Agora não</Button></div>
  </form>;
}