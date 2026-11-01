import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Paperclip, Plus, RotateCw, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAddPurchaseRecord,
  adminDeletePurchaseRecord,
  adminListPurchaseRecords,
  adminListReceiptCandidates,
} from "@/lib/purchase-records.functions";
import { filterPurchaseRecords, purchaseRecordInputSchema, parseAmountInput, totalRecordedPurchases, type PurchaseRecordItem } from "@/lib/purchase-records";
import { createAccountActions } from "@/lib/account-actions";
import { mediaKind } from "@/lib/support-media";

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const day = (iso: string) => iso.split("-").reverse().join("/");

type Candidate = { messageId: string; url: string; type: string | null; sentAt: string };

/** Ficha privada do cliente: compras legítimas, notas e comprovantes. Só admin; nada aqui concede benefício ou licença. */
export function CustomerPurchaseRecords({ userId }: { userId: string }) {
  const list = useServerFn(adminListPurchaseRecords);
  const candidatesFn = useServerFn(adminListReceiptCandidates);
  const add = useServerFn(adminAddPurchaseRecord);
  const remove = useServerFn(adminDeletePurchaseRecord);

  const [items, setItems] = useState<PurchaseRecordItem[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"purchase" | "note">("purchase");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [purchasedOn, setPurchasedOn] = useState("");
  const [note, setNote] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [candidatesError, setCandidatesError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [recordFilter, setRecordFilter] = useState<"all" | "purchase" | "note">("all");
  const actions = useRef(createAccountActions());
  const candidateGen = useRef(0);
  const gen = useRef(0);

  const load = async () => {
    const request = ++gen.current;
    setLoading(true); setError(false);
    try {
      const r = await list({ data: { userId } });
      if (gen.current === request) { setItems(r.items); setTruncated(r.truncated); }
    } catch {
      if (gen.current === request) setError(true);
    } finally {
      if (gen.current === request) setLoading(false);
    }
  };

  const resetForm = () => {
    setKind("purchase"); setTitle(""); setAmount(""); setPurchasedOn(""); setNote("");
    setReceiptId(null); setCandidates(null); setCandidatesError(false);
  };

  useEffect(() => {
    // Troca de cliente: limpa tudo e invalida respostas antigas.
    setItems([]); setTruncated(false); setOpen(false); setBusy(null); setSaving(false);
    actions.current.enter(userId); candidateGen.current++;
    setQuery(""); setRecordFilter("all");
    resetForm();
    void load();
    return () => { gen.current++; candidateGen.current++; actions.current.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const openForm = async (refresh = false) => {
    setOpen(true);
    if (candidates && !refresh) return;
    const request = ++candidateGen.current;
    setCandidatesError(false); setCandidates(null);
    try {
      const r = await candidatesFn({ data: { userId } });
      if (candidateGen.current === request) setCandidates(r.items);
    } catch {
      if (candidateGen.current === request) setCandidatesError(true);
    }
  };

  const save = async () => {
    const parsed = kind === "purchase" ? parseAmountInput(amount) : null;
    if (parsed === "invalid") { toast.error("Valor inválido. Exemplo: 350,00"); return; }
    const payload = purchaseRecordInputSchema.safeParse({
      userId, kind, title: kind === "purchase" ? title : undefined,
      note: note || undefined, amount: parsed,
      purchasedOn: kind === "purchase" && purchasedOn ? purchasedOn : null,
      receiptMessageId: receiptId,
    });
    if (!payload.success) { toast.error(payload.error.issues[0]?.message ?? "Confira os dados do registro."); return; }
    const action = actions.current.begin("mutation");
    if (!action) return;
    setSaving(true);
    try {
      await add({ data: payload.data });
      if (!action.isCurrent()) return;
      toast.success("Registro salvo na ficha");
      resetForm(); setOpen(false);
      await load();
    } catch (e: any) {
      if (!action.isCurrent()) return;
      toast.error(e?.message === "Forbidden" ? "Somente administradores podem editar esta ficha." : e?.message || "Não foi possível salvar o registro.");
    } finally {
      if (action.finish()) setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Remover este registro da ficha? O anexo no chat não é apagado.")) return;
    const action = actions.current.begin("mutation");
    if (!action) return;
    setBusy(id);
    try {
      await remove({ data: { id } });
      if (!action.isCurrent()) return;
      setItems((cur) => cur.filter((i) => i.id !== id));
      toast.success("Registro removido");
    } catch (e: any) {
      if (!action.isCurrent()) return;
      toast.error(e?.message || "Não foi possível remover o registro.");
    } finally {
      if (action.finish()) setBusy(null);
    }
  };

  const total = totalRecordedPurchases(items);
  const visibleItems = filterPurchaseRecords(items, recordFilter, query);

  return (
    <div className="space-y-3" data-sensitive>
      <p className="rounded-lg border border-border/60 bg-card/40 p-2 text-[11px] text-muted-foreground">
        Ficha privada da equipe (somente administradores). É um registro manual: não libera licença, benefício nem confirma pagamento.
      </p>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {items.filter((i) => i.kind === "purchase").length} compra(s) registrada(s) · {brl(total)}
        </p>
        <div className="flex items-center gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Atualizar ficha" title="Atualizar ficha e comprovantes" disabled={loading || saving || busy !== null} onClick={() => void load()}><RotateCw className="h-3.5 w-3.5" /></Button>
        {!open && <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void openForm()}><Plus className="h-3 w-3" />Novo registro</Button>}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar registros" placeholder="Buscar produto ou nota" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 pl-8 text-xs" /></div>
        <div className="flex gap-1" aria-label="Filtrar registros">{(["all", "purchase", "note"] as const).map((f) => <Button key={f} size="sm" variant={recordFilter === f ? "secondary" : "ghost"} aria-pressed={recordFilter === f} className="h-8 px-2 text-xs" onClick={() => setRecordFilter(f)}>{f === "all" ? "Todos" : f === "purchase" ? "Compras" : "Notas"}</Button>)}</div>
      </div>

      {open && (
        <div className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-3">
          <div className="flex gap-1" role="tablist" aria-label="Tipo de registro">
            {(["purchase", "note"] as const).map((k) => (
              <Button key={k} type="button" size="sm" variant={kind === k ? "secondary" : "ghost"} className="h-7 px-2 text-[11px]" onClick={() => setKind(k)}>
                {k === "purchase" ? "Compra" : "Anotação"}
              </Button>
            ))}
          </div>
          {kind === "purchase" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="O que comprou" className="h-8 text-xs sm:col-span-3" aria-label="O que o cliente comprou" />
              <Input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^\d.,R$\s]/g, "").slice(0, 14))} placeholder="Valor (R$)" className="h-8 text-xs" aria-label="Valor pago" />
              <Input type="date" value={purchasedOn} onChange={(e) => setPurchasedOn(e.target.value)} className="h-8 text-xs sm:col-span-2" aria-label="Data da compra" />
            </div>
          )}
          <Textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={kind === "purchase" ? "Observação (opcional). Não escreva senhas nem número de cartão." : "Anotação interna. Não escreva senhas nem número de cartão."} className="text-xs" aria-label="Observação" />

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">Comprovante do cliente</p><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Atualizar anexos" title="Atualizar anexos" onClick={() => void openForm(true)}><RotateCw className="h-3 w-3" /></Button></div>
            {!candidates && !candidatesError && <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Carregando anexos…</p>}
            {candidatesError && <p role="alert" className="text-[11px] text-destructive">Não foi possível carregar os anexos do cliente.</p>}
            {candidates && candidates.length === 0 && <p className="text-[11px] text-muted-foreground">Este cliente ainda não enviou anexos no chat.</p>}
            <div className="flex flex-wrap gap-1.5">
              {(candidates ?? []).map((c) => {
                const selected = receiptId === c.messageId;
                return (
                  <Button key={c.messageId} variant="outline" type="button" aria-label={`Selecionar comprovante de ${fmt.format(new Date(c.sentAt))}`} aria-pressed={selected} onClick={() => setReceiptId(selected ? null : c.messageId)}
                    className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-0 ${selected ? "border-primary ring-2 ring-primary" : "border-border/60"}`}
                    title={fmt.format(new Date(c.sentAt))}>
                    {mediaKind(c.type, c.url) === "image" ? <img src={c.url} alt="Anexo do chat" className="h-full w-full object-cover" /> : <Paperclip className="h-5 w-5 text-muted-foreground" />}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={saving} onClick={() => { candidateGen.current++; resetForm(); setOpen(false); }}>Cancelar</Button>
            <Button size="sm" className="h-7 px-3 text-[11px]" disabled={saving || (kind === "purchase" ? !title.trim() : !note.trim())} onClick={() => void save()}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {loading && items.length === 0 && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Carregando…</p>}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive">
          Não foi possível carregar a ficha de compras.
          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => void load()}><RotateCw className="mr-1 h-3 w-3" />Tentar novamente</Button>
        </div>
      )}
      {!loading && !error && items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>}
      {truncated && <p className="text-[11px] text-muted-foreground">Mostrando os 100 registros mais recentes.</p>}

      <div className="space-y-1.5">
        {!loading && !error && items.length > 0 && visibleItems.length === 0 && <p className="text-xs text-muted-foreground">Nenhum registro encontrado.</p>}
        {visibleItems.map((r) => (
          <article key={r.id} className="rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium text-sm">{r.kind === "purchase" ? r.title : "Anotação"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {r.kind === "purchase" && r.amount != null ? `${brl(r.amount)} · ` : ""}
                  {r.purchasedOn ? `compra em ${day(r.purchasedOn)} · ` : ""}
                  registrado em {fmt.format(new Date(r.createdAt))}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-destructive hover:text-destructive" disabled={busy !== null || saving} onClick={() => void del(r.id)} title="Remover registro" aria-label="Remover registro">
                {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            </div>
            {r.note && <p className="mt-1 whitespace-pre-wrap break-words text-[11px]">{r.note}</p>}
            {r.receipt && (
              <div className="mt-1.5">
                {r.receipt.url ? (
                  <a href={r.receipt.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary underline underline-offset-4"><ExternalLink className="h-3 w-3" />Abrir comprovante</a>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Comprovante indisponível no momento.</span>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
