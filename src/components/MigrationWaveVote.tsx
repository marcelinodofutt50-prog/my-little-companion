import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ThumbsDown, ThumbsUp, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMigrationWaveVote, voteMigrationWave } from "@/lib/migration-wave.functions";
import { toast } from "sonner";

/**
 * Votação do servidor em teste: quem gerou o login de teste decide se o
 * servidor novo deve virar oficial. Um voto por cliente (pode trocar).
 */
export function MigrationWaveVote({ waveId }: { waveId: string }) {
  const qc = useQueryClient();
  const getVote = useServerFn(getMigrationWaveVote);
  const sendVote = useServerFn(voteMigrationWave);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["migration-wave-vote", waveId],
    queryFn: () => getVote({ data: { waveId } }),
    refetchInterval: 60_000,
  });

  if (!data?.canVote) return null;
  const { myVote, tally } = data;

  const submit = async (approve: boolean) => {
    setBusy(true);
    try {
      await sendVote({ data: { waveId, approve, comment: comment || myVote?.comment || "" } });
      toast.success(approve ? "Voto registrado: pode lançar!" : "Voto registrado: ainda não");
      qc.invalidateQueries({ queryKey: ["migration-wave-vote", waveId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao registrar o voto");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-violet/40 bg-violet/5 p-3">
      <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-violet">
        <Vote className="h-3.5 w-3.5" />
        Votação — o servidor novo deve virar oficial?
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={myVote?.approve === true ? "default" : "outline"}
          disabled={busy}
          onClick={() => submit(true)}
          className="h-7 font-mono text-[10px] uppercase"
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <ThumbsUp className="mr-1.5 h-3 w-3" />
          )}
          Sim, pode lançar
        </Button>
        <Button
          size="sm"
          variant={myVote?.approve === false ? "destructive" : "outline"}
          disabled={busy}
          onClick={() => submit(false)}
          className="h-7 font-mono text-[10px] uppercase"
        >
          <ThumbsDown className="mr-1.5 h-3 w-3" />
          Ainda não
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground">
          {tally.total > 0
            ? `${tally.approvePct}% aprovam · ${tally.approve} sim / ${tally.reject} não (${tally.total} votos)`
            : "Seja o primeiro a votar"}
        </span>
      </div>

      {tally.total > 0 ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-violet" style={{ width: `${tally.approvePct}%` }} />
        </div>
      ) : null}

      <Textarea
        value={comment || myVote?.comment || ""}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Conte o que achou do servidor novo (opcional)"
        className="mt-2 font-mono text-[11px]"
      />

      {myVote ? (
        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
          Seu voto atual:{" "}
          <span className={myVote.approve ? "text-neon" : "text-danger"}>
            {myVote.approve ? "pode lançar" : "ainda não"}
          </span>{" "}
          — clique de novo para atualizar o voto ou o comentário.
        </p>
      ) : null}
    </div>
  );
}
