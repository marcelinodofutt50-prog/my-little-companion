import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Row = { id: string; user_id: string; channel_links: string; plan: string; status: string; created_at: string; nick?: string };

export function AdminSupportersPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const { data } = await supabase.from("supporter_applications" as any).select("id, user_id, channel_links, plan, status, created_at").order("created_at", { ascending: false }).range(0, 199);
    const list = ((data as any) ?? []) as Row[];
    const ids = list.map((r) => r.user_id);
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map = new Map((p ?? []).map((x: any) => [x.id, x.display_name]));
      list.forEach((r) => (r.nick = map.get(r.user_id) ?? "—"));
    }
    setRows(list);
  };
  useEffect(() => { load(); }, []);

  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = async (id: string, status: "approved" | "rejected" | "pending") => {
    const { error } = await supabase.from("supporter_applications" as any).update({ status, staff_note: (notes[id] || "").slice(0, 300) || null } as any).eq("id", id);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success(status === "approved" ? "Cargo de Apoiador liberado." : status === "rejected" ? "Pedido recusado." : "Cargo removido, pedido voltou para análise.");
    load();
  };

  return (
    <Card><CardContent className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">Pedidos de Apoiador <span className="text-xs text-muted-foreground">({rows.filter((r) => r.status === "pending").length} pendentes · {rows.filter((r) => r.status === "approved").length} apoiadores)</span></p>
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "pending" ? "Pendentes" : f === "approved" ? "Aprovados" : f === "rejected" ? "Recusados" : "Todos"}</Button>
          ))}
        </div>
      </div>
      {rows.filter((r) => filter === "all" || r.status === filter).length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>}
      {rows.filter((r) => filter === "all" || r.status === filter).map((r) => (
        <div key={r.id} className="space-y-1 rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <b>{r.nick}</b>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{r.status === "pending" ? "pendente" : r.status === "approved" ? "aprovado" : "recusado"}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 text-xs">{r.channel_links.split(/\s+/).filter(Boolean).map((t, i) => /^https:\/\/[^\s]+$/i.test(t) ? <a key={i} href={t} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-primary underline">{t}</a> : <span key={i} className="break-all">{t}</span>)}</div>
          {r.plan && <p className="text-xs text-muted-foreground">{r.plan}</p>}
          {r.status === "pending" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <input value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} maxLength={300} placeholder="Motivo (aparece para o cliente se recusar)" className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs" />
              <Button size="sm" onClick={() => review(r.id, "approved")}>Aprovar</Button>
              <Button size="sm" variant="outline" onClick={() => review(r.id, "rejected")}>Recusar</Button>
            </div>
          )}
          {r.status === "approved" && <Button size="sm" variant="outline" onClick={() => { if (confirm("Remover o cargo de Apoiador?")) review(r.id, "pending"); }}>Remover cargo</Button>}
        </div>
      ))}
    </CardContent></Card>
  );
}
