import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Row = { id: string; user_id: string; channel_links: string; plan: string; status: string; created_at: string; nick?: string };

export function AdminSupportersPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const { data } = await supabase.from("supporter_applications" as any).select("id, user_id, channel_links, plan, status, created_at").order("created_at", { ascending: false }).range(0, 49);
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

  const review = async (id: string, status: "approved" | "rejected") => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("supporter_applications" as any).update({ status, reviewed_by: u.user?.id, reviewed_at: new Date().toISOString() } as any).eq("id", id);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success(status === "approved" ? "Cargo de Apoiador liberado." : "Pedido recusado.");
    load();
  };

  return (
    <Card><CardContent className="space-y-3 p-4">
      <p className="font-bold">Pedidos de Apoiador</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>}
      {rows.map((r) => (
        <div key={r.id} className="space-y-1 rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <b>{r.nick}</b>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{r.status === "pending" ? "pendente" : r.status === "approved" ? "aprovado" : "recusado"}</span>
          </div>
          <p className="break-all text-xs">{r.channel_links}</p>
          {r.plan && <p className="text-xs text-muted-foreground">{r.plan}</p>}
          {r.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => review(r.id, "approved")}>Aprovar</Button>
              <Button size="sm" variant="outline" onClick={() => review(r.id, "rejected")}>Recusar</Button>
            </div>
          )}
        </div>
      ))}
    </CardContent></Card>
  );
}
