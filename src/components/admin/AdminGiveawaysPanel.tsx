import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, Megaphone, Trophy, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PaymentCelebration } from "@/components/PaymentCelebration";
import { adminListGiveaways, adminCreateGiveaway, adminDrawGiveaway, adminCancelGiveaway } from "@/lib/giveaways.functions";

type Draw = { winner: string; pool: string[]; prize: string; eligible: number };

export function AdminGiveawaysPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListGiveaways);
  const createFn = useServerFn(adminCreateGiveaway);
  const drawFn = useServerFn(adminDrawGiveaway);
  const cancelFn = useServerFn(adminCancelGiveaway);
  const { data: list = [], isLoading } = useQuery({ queryKey: ["admin-giveaways"], queryFn: () => listFn() });

  const [form, setForm] = useState({ title: "", prize: "", description: "", min_account_days: 7, require_nickname: true, require_avatar: false, require_paid: false, announce: true });
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [show, setShow] = useState<Draw | null>(null);

  const create = async () => {
    setSaving(true);
    try {
      await createFn({ data: form });
      toast.success(form.announce ? "Sorteio criado e anunciado para os clientes!" : "Sorteio criado.");
      setForm({ ...form, title: "", prize: "", description: "" });
      qc.invalidateQueries({ queryKey: ["admin-giveaways"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar sorteio");
    } finally {
      setSaving(false);
    }
  };

  const draw = async (id: string) => {
    if (!confirm("Sortear agora? O resultado é definitivo.")) return;
    setDrawing(id);
    try {
      const r = await drawFn({ data: { id } });
      setShow(r);
      qc.invalidateQueries({ queryKey: ["admin-giveaways"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao sortear");
    } finally {
      setDrawing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="terminal-card space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Novo sorteio</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Nome do sorteio (ex.: Sorteio de Outubro)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Prêmio (ex.: Licença Vitalícia)" value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} />
        </div>
        <Textarea placeholder="Descrição opcional para o anúncio" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
            Dias mínimos de cadastro
            <Input type="number" min={0} max={365} className="w-20" value={form.min_account_days} onChange={(e) => setForm({ ...form, min_account_days: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
          {([
            ["require_nickname", "Exigir apelido próprio no perfil"],
            ["require_avatar", "Exigir foto de perfil"],
            ["require_paid", "Só clientes com plano pago"],
            ["announce", "Anunciar para os clientes agora"],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
              {label}
              <Switch checked={form[k]} onCheckedChange={(v) => setForm({ ...form, [k]: v })} />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Regras fixas: e-mail confirmado, conta sem bloqueio, fora da equipe e sem ter ganho outro sorteio nos últimos 30 dias.</p>
        <Button onClick={create} disabled={saving || form.title.length < 3 || form.prize.length < 2}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
          {form.announce ? "Criar e anunciar" : "Criar sorteio"}
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {(list as any[]).map((g) => (
          <div key={g.id} className="terminal-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="font-semibold">{g.title} <span className="text-primary">· {g.prize}</span></div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {g.eligible_count ?? 0} participando</span>
                <span>{g.min_account_days}+ dias de cadastro</span>
                {g.require_nickname && <span>apelido</span>}
                {g.require_avatar && <span>foto</span>}
                {g.require_paid && <span>plano pago</span>}
              </div>
              {g.status === "drawn" && <div className="mt-1 text-sm"><Trophy className="mr-1 inline h-4 w-4 text-primary" />Vencedor: <b>{g.winner_label}</b></div>}
              {g.status === "cancelled" && <div className="mt-1 text-xs text-destructive">Cancelado</div>}
            </div>
            {g.status === "open" && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={async () => { await cancelFn({ data: { id: g.id } }); qc.invalidateQueries({ queryKey: ["admin-giveaways"] }); }}>Cancelar</Button>
                <Button onClick={() => draw(g.id)} disabled={drawing !== null || !g.eligible_count}>
                  {drawing === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />} Sortear agora
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {show && <DrawShow draw={show} onClose={() => setShow(null)} />}
    </div>
  );
}

function DrawShow({ draw, onClose }: { draw: Draw; onClose: () => void }) {
  const pool = draw.pool.length ? draw.pool : [draw.winner];
  const [name, setName] = useState(pool[0]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let delay = 60;
    let t: number;
    const tick = () => {
      i++;
      setName(pool[i % pool.length]);
      delay *= 1.08;
      if (delay > 420) {
        setName(draw.winner);
        setDone(true);
        return;
      }
      t = window.setTimeout(tick, delay);
    };
    t = window.setTimeout(tick, delay);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background/95 backdrop-blur">
      <button onClick={onClose} className="absolute right-6 top-6 rounded-full border border-border p-2 text-muted-foreground hover:text-foreground" aria-label="Fechar">
        <X className="h-5 w-5" />
      </button>
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary">Sorteio Shadow · {draw.eligible} participantes</p>
      <p className="mt-3 text-lg text-muted-foreground">Prêmio: <b className="text-foreground">{draw.prize}</b></p>
      <div className={`mt-10 rounded-2xl border-2 px-10 py-8 text-center font-black tracking-tight transition-all ${done ? "scale-110 border-primary text-5xl text-primary shadow-[0_0_80px_hsl(var(--primary)/0.5)] sm:text-7xl" : "border-border text-4xl sm:text-6xl"}`}>
        {name}
      </div>
      {done && <p className="mt-8 font-mono text-sm uppercase tracking-[0.3em] text-primary">🏆 Temos um vencedor!</p>}
      {done && <PaymentCelebration title="" subtitle="" durationMs={4500} />}
    </div>
  );
}
