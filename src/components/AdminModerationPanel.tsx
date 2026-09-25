import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminListBlockedMessages, adminResolveBlockedMessage } from "@/lib/ban.functions";

export function AdminModerationPanel() {
  const qc = useQueryClient();
  const list = useServerFn(adminListBlockedMessages);
  const resolve = useServerFn(adminResolveBlockedMessage);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-blocked-messages"], queryFn: () => list() });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: "release" | "delete") {
    setBusyId(id);
    try {
      await resolve({ data: { id, action } });
      toast.success(action === "release" ? "Mensagem liberada na Comunidade" : "Mensagem apagada");
      qc.invalidateQueries({ queryKey: ["admin-blocked-messages"] });
    } catch (e: any) {
      toast.error(String(e?.message ?? e).replace(/^Error:\s*/, ""));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="enterprise-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase">Moderação da Comunidade</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Mensagens barradas pelo filtro (venda, preço, contato externo, links). Liberar publica a mensagem e retira a infração.
          </p>
        </div>
        <ShieldAlert className="h-5 w-5 text-destructive" />
      </div>
      <div className="space-y-2 p-5">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {error && <p className="text-xs text-destructive">{String((error as any)?.message ?? error)}</p>}
        {!isLoading && (data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem bloqueada.</p>}
        {(data ?? []).map((m: any) => (
          <div key={m.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/50 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{m.name || m.email || m.user_id}</span>
                <span>{m.email}</span>
                <span>· {new Date(m.created_at).toLocaleString("pt-BR")}</span>
                <span className="rounded border border-destructive/40 px-1.5 text-destructive">{m.reason}</span>
              </div>
              <p className="mt-1 break-words text-sm">{m.content || "—"}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => void act(m.id, "release")}>
                <Check className="mr-1 h-3 w-3" /> Liberar
              </Button>
              <Button size="sm" variant="destructive" disabled={busyId === m.id} onClick={() => void act(m.id, "delete")}>
                <Trash2 className="mr-1 h-3 w-3" /> Apagar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
