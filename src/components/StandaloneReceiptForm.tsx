import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { CheckCircle2, Loader2, ShieldCheck, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitStandaloneReceipt } from '@/lib/purchase-evidence.functions';
import { MAX_RECEIPT_BYTES } from '@/lib/purchase-evidence-rules';

/**
 * Envio de comprovante SEM pedido interno (checkout externo / Cakto).
 * Vai direto para a aba "Comprovantes" da central da equipe — sem abrir ticket.
 */
export function StandaloneReceiptForm({ onSent }: { onSent?: () => void }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = useServerFn(submitStandaloneReceipt);

  if (sent) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <span>Comprovante enviado à equipe. Assim que validarmos, seu acesso é liberado.</span>
      </div>
    );
  }

  return (
    <form
      className="space-y-3 text-left"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file || busy) return;
        if (file.size > MAX_RECEIPT_BYTES || file.size === 0) return setError('Envie um arquivo de até 5 MB.');
        setBusy(true);
        setError('');
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          await submit({ data: { payerName: name, filename: file.name, base64 } });
          setSent(true);
          onSent?.();
        } catch (err: any) {
          setError(err?.message || 'Não foi possível enviar. Confira o arquivo e tente novamente.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-xs font-medium">
        Nome do pagador no comprovante
        <Input
          data-sensitive
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={3}
          maxLength={120}
          className="mt-1"
          autoComplete="name"
          placeholder="Quem fez o pagamento"
        />
      </label>
      <label className="block text-xs font-medium">
        Comprovante — JPG, PNG ou PDF (até 5 MB)
        <Input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1"
        />
      </label>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Privado: só a equipe vê, nunca outros clientes.
      </p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={busy || !file || name.trim().length < 3}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
        Enviar comprovante
      </Button>
    </form>
  );
}
