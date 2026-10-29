import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminAddWinner, adminListWinners, adminRemoveWinner } from "@/lib/winner-board.functions";
import { winnerNickname } from "@/lib/winner-board";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function AdminWinnerBoardPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListWinners);
  const addFn = useServerFn(adminAddWinner);
  const removeFn = useServerFn(adminRemoveWinner);
  const { data: rows = [], isLoading, isError, refetch } = useQuery({ queryKey: ["admin-winner-board"], queryFn: () => listFn() });
  const [form, setForm] = useState({ nickname: "", giveaway_title: "", prize_label: "", awarded_on: today() });
  const [busy, setBusy] = useState<string | null>(null);

  const nickCheck = form.nickname ? winnerNickname.safeParse(form.nickname) : null;
  const valid = !!nickCheck?.success && form.giveaway_title.trim().length >= 3 && form.prize_label.trim().length >= 2 && !!form.awarded_on;

  const add = async () => {
    if (busy) return;
    setBusy("add");
    try {
      await addFn({ data: form });
      toast.success("Vencedor registrado na tabela pública.");
      setForm({ ...form, nickname: "" });
      await qc.invalidateQueries({ queryKey: ["admin-winner-board"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string, nickname: string) => {
    if (busy || !window.confirm(`Remover "${nickname}" da tabela pública?`)) return;
    setBusy(id);
    try {
      await removeFn({ data: { id } });
      toast.success("Registro removido.");
      await qc.invalidateQueries({ queryKey: ["admin-winner-board"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="terminal-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Tabela pública de vencedores</h2></div>
        <Link to="/vencedores" className="text-xs text-primary underline">Ver página pública</Link>
      </div>
      <p className="text-xs text-muted-foreground">Cadastro manual: só o apelido aparece para o público. Isto não sorteia nem entrega licenças.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Apelido do vencedor" maxLength={24} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} aria-invalid={nickCheck ? !nickCheck.success : undefined} />
        <Input type="date" value={form.awarded_on} onChange={(e) => setForm({ ...form, awarded_on: e.target.value })} />
        <Input placeholder="Nome do sorteio (ex.: Sorteio 1K)" maxLength={100} value={form.giveaway_title} onChange={(e) => setForm({ ...form, giveaway_title: e.target.value })} />
        <Input placeholder="Prêmio (como será mostrado)" maxLength={120} value={form.prize_label} onChange={(e) => setForm({ ...form, prize_label: e.target.value })} />
      </div>
      {nickCheck && !nickCheck.success && <p className="text-xs text-destructive">{nickCheck.error.issues[0]?.message}</p>}
      <Button onClick={add} disabled={!valid || busy !== null}>{busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />} Registrar vencedor</Button>

      {isError && <div role="alert" className="flex items-center gap-3 text-sm text-destructive">Não foi possível carregar a lista.<Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button></div>}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && !isError && rows.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">Nenhum vencedor registrado ainda.</p>}
      <ul className="divide-y divide-border/50">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate"><b className="text-primary">{r.nickname}</b> · {r.giveaway_title} · {r.prize_label} · {r.awarded_on.split("-").reverse().join("/")}</span>
            <Button variant="ghost" size="icon" aria-label={`Remover ${r.nickname}`} disabled={busy !== null} onClick={() => void remove(r.id, r.nickname)}>
              {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
