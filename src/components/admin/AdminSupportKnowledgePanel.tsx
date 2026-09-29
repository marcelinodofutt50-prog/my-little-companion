import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Row = {
  id: string; question: string; answer: string; status: "active" | "disabled";
  uses: number; last_used_at: string | null; created_at: string;
};

export default function AdminSupportKnowledgePanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function load() {
    setLoading(true); setError(null);
    const { data, error } = await (supabase as any).from("support_knowledge")
      .select("id,question,answer,status,uses,last_used_at,created_at")
      .order("created_at", { ascending: false }).range(0, 299);
    if (error) setError(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function update(id: string, patch: Partial<Row>) {
    const { error } = await (supabase as any).from("support_knowledge")
      .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setError(error.message); return; }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  async function remove(id: string) {
    if (!confirm("Apagar este aprendizado?")) return;
    const { error } = await (supabase as any).from("support_knowledge").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    setRows((r) => r.filter((x) => x.id !== id));
  }

  const term = q.trim().toLowerCase();
  const list = term ? rows.filter((r) => (r.question + " " + r.answer).toLowerCase().includes(term)) : rows;
  const active = rows.filter((r) => r.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="rounded border border-border/40 bg-background/40 p-4 font-mono text-xs text-muted-foreground">
        Cada vez que a equipe responde um cliente no suporte, o robô guarda a dúvida e a resposta (sem e-mails, senhas ou códigos).
        Quando outro cliente relatar algo parecido, ele usa essas respostas como referência. Desative ou corrija o que estiver errado.
        <div className="mt-2 text-foreground">{active} ativos · {rows.length} no total</div>
      </div>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por palavra..." className="font-mono text-xs" />
        <Button variant="outline" size="sm" onClick={load}>Atualizar</Button>
      </div>
      {error && <div className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive">{error}</div>}
      {loading ? (
        <div className="font-mono text-xs text-muted-foreground">Carregando...</div>
      ) : list.length === 0 ? (
        <div className="rounded border border-dashed border-border/40 p-6 text-center font-mono text-xs text-muted-foreground">
          Nada aprendido ainda. Responda clientes no suporte e os casos aparecem aqui.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className={`rounded border p-3 text-sm ${r.status === "active" ? "border-border/40" : "border-border/20 opacity-60"}`}>
              <div className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">
                {new Date(r.created_at).toLocaleString("pt-BR")} · usado {r.uses}x {r.status === "disabled" && "· desativado"}
              </div>
              <div className="whitespace-pre-wrap"><span className="text-muted-foreground">Cliente: </span>{r.question}</div>
              {editing === r.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={draft.trim().length < 10} onClick={async () => { await update(r.id, { answer: draft.trim() }); setEditing(null); }}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 whitespace-pre-wrap"><span className="text-muted-foreground">Equipe: </span>{r.answer}</div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(r.id); setDraft(r.answer); }}>Corrigir resposta</Button>
                <Button size="sm" variant="outline" onClick={() => update(r.id, { status: r.status === "active" ? "disabled" : "active" })}>
                  {r.status === "active" ? "Desativar" : "Reativar"}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}>Apagar</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
