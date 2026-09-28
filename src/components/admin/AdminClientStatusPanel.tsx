import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Lic = {
  id: string; user_id: string; panel: string; version_tier: string | null; plan_slug: string;
  expires_at: string | null; revoked: boolean; disabled_at: string | null; is_trial: boolean;
  yaarsa_email: string; password_sync_status: string | null; password_sync_error: string | null;
  server_paid_until: string | null; server_overdue_at: string | null; suspended_at: string | null;
};
type Thread = { user_id: string; status: string; unread_by_staff: number };
type Row = { userId: string; email: string; lics: Lic[]; pend: string[] };

function pendingFor(lics: Lic[], threads: Thread[]): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (const l of lics) {
    const tag = `${l.yaarsa_email} (${l.version_tier ?? l.panel})`;
    if (l.revoked) out.push(`Licença revogada: ${tag}`);
    else if (l.suspended_at) out.push(`Login pausado: ${tag}`);
    else if (l.expires_at && new Date(l.expires_at).getTime() < now) out.push(`Vencida: ${tag}`);
    else if (l.expires_at && new Date(l.expires_at).getTime() - now < 3 * 864e5) out.push(`Vence em menos de 3 dias: ${tag}`);
    if (l.server_overdue_at) out.push(`Servidor em atraso: ${tag}`);
    if (l.password_sync_status && !["ok", "synced", "success"].includes(l.password_sync_status))
      out.push(`Senha não sincronizada: ${tag}${l.password_sync_error ? ` — ${l.password_sync_error}` : ""}`);
  }
  const open = threads.filter((t) => t.status !== "closed");
  const unread = open.reduce((s, t) => s + (t.unread_by_staff || 0), 0);
  if (unread > 0) out.push(`${unread} mensagem(ns) sem resposta no suporte`);
  else if (open.length) out.push(`${open.length} chamado(s) aberto(s)`);
  return out;
}

export default function AdminClientStatusPanel() {
  const [lics, setLics] = useState<Lic[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);

  async function load() {
    setLoading(true); setError(null);
    const [l, t] = await Promise.all([
      supabase.from("licenses").select("id,user_id,panel,version_tier,plan_slug,expires_at,revoked,disabled_at,is_trial,yaarsa_email,password_sync_status,password_sync_error,server_paid_until,server_overdue_at,suspended_at").is("disabled_at", null).eq("is_trial", false).order("created_at", { ascending: false }).range(0, 1999),
      supabase.from("support_threads").select("user_id,status,unread_by_staff").neq("status", "closed").range(0, 1999),
    ]);
    if (l.error || t.error) setError((l.error ?? t.error)!.message);
    setLics((l.data ?? []) as Lic[]); setThreads((t.data ?? []) as Thread[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const l of lics) {
      const r = map.get(l.user_id) ?? { userId: l.user_id, email: l.yaarsa_email, lics: [], pend: [] };
      r.lics.push(l); map.set(l.user_id, r);
    }
    for (const t of threads) if (!map.has(t.user_id)) map.set(t.user_id, { userId: t.user_id, email: t.user_id.slice(0, 8), lics: [], pend: [] });
    const term = q.trim().toLowerCase();
    return [...map.values()]
      .map((r) => ({ ...r, pend: pendingFor(r.lics, threads.filter((t) => t.user_id === r.userId)) }))
      .filter((r) => (!onlyPending || r.pend.length > 0) && (!term || r.email.toLowerCase().includes(term) || r.lics.some((l) => l.yaarsa_email.toLowerCase().includes(term))))
      .sort((a, b) => b.pend.length - a.pend.length);
  }, [lics, threads, q, onlyPending]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar por e-mail…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Button variant={onlyPending ? "default" : "outline"} size="sm" onClick={() => setOnlyPending((v) => !v)}>
          {onlyPending ? "Só com pendências" : "Todos os clientes"}
        </Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? "Carregando…" : "Atualizar"}</Button>
        <span className="text-xs text-muted-foreground">{rows.length} cliente(s)</span>
      </div>
      {error && <p className="text-sm text-destructive">Erro ao carregar: {error}</p>}
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.userId} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">{r.email}</p>
              <div className="flex flex-wrap gap-1">
                {r.lics.map((l) => (
                  <span key={l.id} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {l.version_tier ?? l.panel} · {l.plan_slug} · {l.expires_at ? `até ${new Date(l.expires_at).toLocaleDateString("pt-BR")}` : "vitalícia"}
                  </span>
                ))}
              </div>
            </div>
            {r.pend.length ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-primary">{r.pend.map((p, i) => <li key={i}>{p}</li>)}</ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nada pendente.</p>
            )}
          </div>
        ))}
        {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
      </div>
    </div>
  );
}
