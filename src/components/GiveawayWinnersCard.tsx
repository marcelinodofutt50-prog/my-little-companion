import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Gift, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminAddWinner, adminRemoveWinner, adminUpdateWinner, amIWinnerAdmin, listPublicWinners } from "@/lib/winner-board.functions";
import { groupWinnersByGiveaway, type WinnerRow } from "@/lib/winner-groups";
import { winnerNickname } from "@/lib/winner-board";

const KEY = ["public-winner-board"];
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function useWinnerBoard() {
  const fn = useServerFn(listPublicWinners);
  return useQuery({ queryKey: KEY, queryFn: () => fn(), staleTime: 30_000 });
}

export function useIsWinnerAdmin() {
  const fn = useServerFn(amIWinnerAdmin);
  const { data } = useQuery({ queryKey: ["am-i-winner-admin"], queryFn: () => fn(), staleTime: 300_000, retry: false });
  return data?.isAdmin === true;
}

export function WinnersGrid({ winners }: { winners: Pick<WinnerRow, "id" | "nickname" | "prize_label">[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {winners.map((w) => (
        <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 p-3">
          <Award className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{w.nickname}</div>
            <div className="text-[10px] uppercase text-muted-foreground">{w.prize_label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Botão visível só para administradores; a gravação é revalidada no servidor e no banco. */
export function EditWinnersButton({ title }: { title: string }) {
  const isAdmin = useIsWinnerAdmin();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} aria-label={`Editar vencedores de ${title}`}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
      </Button>
      {open && <EditWinnersDialog title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditWinnersDialog({ title, onClose }: { title: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useWinnerBoard();
  const addFn = useServerFn(adminAddWinner);
  const updateFn = useServerFn(adminUpdateWinner);
  const removeFn = useServerFn(adminRemoveWinner);
  const rows = groupWinnersByGiveaway(data?.winners ?? []).find((g) => g.title === title)?.winners ?? [];
  const [drafts, setDrafts] = useState<Record<string, { nickname: string; prize_label: string }>>({});
  const [form, setForm] = useState({ nickname: "", prize_label: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const run = async (key: string, job: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(key);
    try { await job(); toast.success(ok); await refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Não foi possível concluir."); }
    finally { setBusy(null); }
  };

  const addValid = winnerNickname.safeParse(form.nickname).success && form.prize_label.trim().length >= 2;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar vencedores</DialogTitle>
          <DialogDescription>{title} — só o apelido aparece para o público. Isto não entrega licenças.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vencedor registrado ainda.</p>}
          {rows.map((r) => {
            const d = drafts[r.id] ?? { nickname: r.nickname, prize_label: r.prize_label };
            const dirty = d.nickname !== r.nickname || d.prize_label !== r.prize_label;
            const ok = winnerNickname.safeParse(d.nickname).success && d.prize_label.trim().length >= 2;
            return (
              <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <Input value={d.nickname} maxLength={24} aria-label="Apelido" onChange={(e) => setDrafts({ ...drafts, [r.id]: { ...d, nickname: e.target.value } })} />
                <Input value={d.prize_label} maxLength={120} aria-label="Prêmio" onChange={(e) => setDrafts({ ...drafts, [r.id]: { ...d, prize_label: e.target.value } })} />
                <div className="flex gap-1">
                  <Button size="sm" disabled={!dirty || !ok || !!busy} onClick={() => run(r.id, () => updateFn({ data: { id: r.id, ...d } }).then(() => setDrafts(({ [r.id]: _, ...rest }) => rest)), "Alteração salva.")}>
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Remover ${r.nickname}`} disabled={!!busy}
                    onClick={() => window.confirm(`Remover "${r.nickname}" desta tabela?`) && run(r.id, () => removeFn({ data: { id: r.id } }), "Vencedor removido.")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-t border-border pt-3">
            <Input placeholder="Apelido" maxLength={24} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
            <Input placeholder="Prêmio (ex.: Licença Mensal)" maxLength={120} value={form.prize_label} onChange={(e) => setForm({ ...form, prize_label: e.target.value })} />
            <Button size="sm" disabled={!addValid || !!busy}
              onClick={() => run("add", () => addFn({ data: { nickname: form.nickname, prize_label: form.prize_label, giveaway_title: title, awarded_on: today() } }).then(() => setForm({ nickname: "", prize_label: "" })), "Vencedor adicionado.")}>
              {busy === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Um card por sorteio cadastrado, todos no mesmo estilo de tabela. `exclude` evita repetir o sorteio já exibido. */
export function GiveawayWinnersCards({ exclude }: { exclude?: string }) {
  const { data } = useWinnerBoard();
  const isAdmin = useIsWinnerAdmin();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const groups = groupWinnersByGiveaway(data?.winners ?? []).filter((g) => g.title !== exclude);
  const [pending, setPending] = useState<string | null>(null);
  const titleOk = newTitle.trim().length >= 3;

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <Card key={g.title} className="overflow-hidden border-primary/20 bg-card/50">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base uppercase"><Gift className="h-5 w-5 text-primary" /> {g.title}</CardTitle>
            <div className="flex items-center gap-2"><Badge variant="outline">Concluído</Badge><EditWinnersButton title={g.title} /></div>
          </CardHeader>
          <CardContent><WinnersGrid winners={g.winners} /></CardContent>
        </Card>
      ))}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {creating ? (
            <>
              <Input className="max-w-xs" placeholder="Nome do novo sorteio" maxLength={100} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <Button size="sm" disabled={!titleOk} onClick={() => { setPending(newTitle.trim()); setCreating(false); setNewTitle(""); }}>Criar e adicionar vencedores</Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-3.5 w-3.5" /> Novo sorteio</Button>
          )}
        </div>
      )}
      {pending && <EditWinnersDialog title={pending} onClose={() => setPending(null)} />}
    </div>
  );
}
