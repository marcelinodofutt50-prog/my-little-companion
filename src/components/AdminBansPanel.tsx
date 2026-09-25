import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminBanDetail } from "@/components/AdminBanDetail";
import { adminBanUser, adminListBans, adminSetBanMultiplier, adminUnbanUser } from "@/lib/ban.functions";

export function AdminBansPanel() {
  const qc = useQueryClient();
  const list = useServerFn(adminListBans);
  const ban = useServerFn(adminBanUser);
  const unban = useServerFn(adminUnbanUser);
  const setMult = useServerFn(adminSetBanMultiplier);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-bans"], queryFn: () => list() });
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-bans"] });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e: any) {
      toast.error(String(e?.message ?? e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  };

  const active = (data ?? []).filter((b: any) => !b.revoked_at);

  return (
    <section className="enterprise-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase">Clientes Bloqueados</h2>
          <p className="mt-1 text-xs text-muted-foreground">{active.length} contas banidas ativas · 4+ contas ligadas = banimento automático</p>
        </div>
        <Ban className="h-5 w-5 text-destructive" />
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="e-mail da conta" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-xs" />
          <Input placeholder="motivo" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-sm" />
          <Button
            variant="destructive"
            disabled={busy || !email || reason.length < 3}
            onClick={() => void run(() => ban({ data: { email, reason, multiplier: 1.5 } }), "Conta banida").then(() => { setEmail(""); setReason(""); })}
          >
            Banir manualmente
          </Button>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {error && <p className="text-xs text-destructive">{String((error as any)?.message ?? error)}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Conta</th>
                <th className="py-2 pr-3">Motivo</th>
                <th className="py-2 pr-3">Origem</th>
                <th className="py-2 pr-3">Acréscimo</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((b: any) => (
                <Fragment key={b.id}>
                <tr key={b.id} className={`border-t border-border/40 ${b.revoked_at ? "opacity-50" : ""}`}>
                  <td className="py-2 pr-3 font-mono">
                    <button type="button" className="underline-offset-2 hover:underline" onClick={() => setOpen(open === b.id ? null : b.id)}>
                      {open === b.id ? "▾" : "▸"} {b.email ?? b.user_id}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    {b.reason}
                    {Array.isArray(b.evidence?.linked_accounts) && (
                      <span className="block text-muted-foreground">{b.evidence.linked_accounts.length} contas ligadas</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{b.source === "manual" ? "Manual" : "Automático"}</td>
                  <td className="py-2 pr-3">
                    <select
                      className="rounded border border-border bg-background px-1 py-0.5"
                      value={String(b.price_multiplier)}
                      disabled={busy || !!b.revoked_at}
                      onChange={(e) => void run(() => setMult({ data: { banId: b.id, multiplier: Number(e.target.value) } }), "Acréscimo atualizado")}
                    >
                      {[1, 1.25, 1.5, 2, 3].map((m) => (
                        <option key={m} value={String(m)}>{Math.round((m - 1) * 100)}%</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">{new Date(b.created_at).toLocaleString("pt-BR")}</td>
                  <td className="py-2">
                    {b.revoked_at ? (
                      <span className="text-muted-foreground">Desbanido</span>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => unban({ data: { banId: b.id, includeLinked: false } }), "Conta desbanida")}>
                          <RotateCcw className="mr-1 h-3 w-3" /> Desbanir
                        </Button>
                        {b.linked_group_id && (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => unban({ data: { banId: b.id, includeLinked: true } }), "Grupo desbanido")}>
                            + ligadas
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {open === b.id && (
                  <tr key={`${b.id}-d`} className="bg-muted/20">
                    <td colSpan={6} className="p-3"><AdminBanDetail banId={b.id} /></td>
                  </tr>
                )}
                </Fragment>
              ))}
              {!isLoading && (data ?? []).length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Nenhum banimento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
