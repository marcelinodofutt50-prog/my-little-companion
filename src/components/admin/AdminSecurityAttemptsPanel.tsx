import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Attempt = {
  id: string; created_at: string; kind: string; user_id: string | null; email: string | null;
  ip: string | null; user_agent: string | null; details: any;
};

const FLAG_LABEL: Record<string, string> = {
  "fingiu-ser-outro-usuario": "Tentou mandar como outra pessoa",
  "fingiu-mensagem-do-sistema": "Tentou mandar como Sistema",
  "fingiu-ser-equipe": "Tentou se marcar como equipe",
  "nome-ou-cargo-falso": "Tentou usar nome/cargo falso",
  "alterou-remetente-de-mensagem": "Tentou trocar o remetente de mensagem antiga",
  "pagamento-cripto-ja-confirmado": "Tentou criar pagamento cripto já confirmado",
  "apk-com-campos-de-sistema": "Tentou criar APK pronto/grátis ou apontar para arquivo de outro",
  "migracao-ja-aprovada": "Tentou criar migração já aprovada",
  "candidatura-ja-aprovada": "Tentou se aprovar na equipe",
  "chamado-com-atendente-falso": "Tentou abrir chamado com atendente falso",
  "perfil-com-pontos-ou-vip": "Tentou criar perfil com pontos/VIP",
};

export default function AdminSecurityAttemptsPanel() {
  const [rows, setRows] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | "chat_spoof" | "trial_block" | "forged_insert">("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true); setError(null);
    let query = (supabase as any).from("security_attempts")
      .select("id,created_at,kind,user_id,email,ip,user_agent,details")
      .order("created_at", { ascending: false }).range(0, 499);
    if (kind !== "all") query = query.eq("kind", kind);
    const { data, error } = await query;
    if (error) setError(error.message);
    setRows((data ?? []) as Attempt[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [kind]);

  const term = q.trim().toLowerCase();
  const shown = rows.filter((r) => !term || (r.email ?? "").toLowerCase().includes(term) || (r.ip ?? "").includes(term));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "chat_spoof", "trial_block", "forged_insert"] as const).map((k) => (
          <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
            {k === "all" ? "Tudo" : k === "chat_spoof" ? "Golpe no chat" : k === "trial_block" ? "Teste grátis bloqueado" : "Dados forjados"}
          </Button>
        ))}
        <Input placeholder="Buscar e-mail ou IP…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? "Carregando…" : "Atualizar"}</Button>
        <span className="text-xs text-muted-foreground">{shown.length} registro(s)</span>
      </div>
      {error && <p className="text-sm text-destructive">Erro ao carregar: {error}</p>}
      <div className="grid gap-2">
        {shown.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={r.kind === "chat_spoof" ? "font-semibold text-destructive" : "font-semibold text-primary"}>
                {r.kind === "chat_spoof" ? "Golpe no chat" : r.kind === "trial_block" ? "Teste grátis bloqueado" : `Dados forjados (${r.details?.tabela ?? ""})`}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <p className="mt-1 text-foreground">{r.email ?? r.user_id ?? "sem conta"} · IP <span className="font-mono">{r.ip ?? "desconhecido"}</span></p>
            {r.kind !== "trial_block" ? (
              <>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {(r.details?.flags ?? []).map((f: string) => <li key={f}>{FLAG_LABEL[f] ?? f}</li>)}
                </ul>
                {r.details?.texto && <p className="mt-1 rounded bg-muted p-2 text-xs text-muted-foreground">"{r.details.texto}"</p>}
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">{r.details?.motivo}</p>
            )}
            {r.user_agent && <p className="mt-1 truncate text-xs text-muted-foreground">{r.user_agent}</p>}
          </div>
        ))}
        {!loading && shown.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tentativa registrada.</p>}
      </div>
    </div>
  );
}
