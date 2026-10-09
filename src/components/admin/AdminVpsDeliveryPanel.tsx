import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Server, ShieldCheck, CheckCircle2, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminDeliverVps, adminListVpsOrders } from "@/lib/vps-admin.functions";

type VpsOrder = {
  id: string; user_id: string; order_reference: string; plan_name: string;
  cpu_brand: "intel" | "amd"; amount_cents: number; payment_status: string;
  created_at: string;
  profile: { email?: string | null; full_name?: string | null; display_name?: string | null } | null;
  delivered_at: string | null;
};

export function AdminVpsDeliveryPanel() {
  const listFn = useServerFn(adminListVpsOrders);
  const deliverFn = useServerFn(adminDeliverVps);
  const [orders, setOrders] = useState<VpsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<VpsOrder | null>(null);
  const [serverIp, setServerIp] = useState("");
  const [serverPort, setServerPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [initialPassword, setInitialPassword] = useState("");
  const [note, setNote] = useState("");

  async function refresh() {
    setLoading(true);
    try { setOrders(((await listFn()) as VpsOrder[]) ?? []); }
    catch (error: any) { toast.error(error?.message ?? "Não foi possível carregar os pedidos VPS."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function deliver() {
    if (!selected) return;
    setSaving(true);
    try {
      await deliverFn({ data: { orderId: selected.id, serverIp, serverPort: Number(serverPort), username, initialPassword, note } });
      toast.success("Entrega registrada com credenciais protegidas.");
      setSelected(null); setServerIp(""); setServerPort("22"); setUsername("root"); setInitialPassword(""); setNote("");
      await refresh();
    } catch (error: any) { toast.error(error?.message ?? "Não foi possível registrar a entrega."); }
    finally { setSaving(false); }
  }

  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const date = (value: string) => new Date(value).toLocaleString("pt-BR");

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Server className="h-5 w-5" /> Gerenciamento de VPS</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pedidos confirmados e entregas manuais. Acesso exclusivo de administradores.</p></div>
      <Button variant="outline" onClick={() => void refresh()} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Atualizar</Button>
    </div>
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      <ShieldCheck className="mr-2 inline h-4 w-4" /> A senha é armazenada criptografada com AES-256-GCM. Configure a variável secreta <code>VPS_DELIVERY_ENCRYPTION_KEY</code> no servidor (64 caracteres hexadecimais); nunca a exponha no frontend.
    </div>
    {selected && <div className="rounded-xl border border-primary/40 bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-semibold">Entregar VPS · {selected.plan_name}</h3><p className="text-sm text-muted-foreground">{selected.profile?.email ?? selected.user_id}</p></div>
        <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">IP ou hostname<Input value={serverIp} onChange={e => setServerIp(e.target.value)} placeholder="IP ou hostname do servidor" /></label>
        <label className="space-y-1 text-sm">Porta<Input value={serverPort} onChange={e => setServerPort(e.target.value)} inputMode="numeric" /></label>
        <label className="space-y-1 text-sm">Usuário<Input value={username} onChange={e => setUsername(e.target.value)} placeholder="root" /></label>
        <label className="space-y-1 text-sm">Senha inicial<Input value={initialPassword} onChange={e => setInitialPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="Mínimo de 12 caracteres" /></label>
        <label className="space-y-1 text-sm md:col-span-2">Observação interna (opcional)<Input value={note} onChange={e => setNote(e.target.value)} placeholder="Instruções não secretas" /></label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Use uma senha temporária exclusiva e oriente o cliente a trocá-la no primeiro acesso.</p>
      <Button className="mt-4" onClick={() => void deliver()} disabled={saving || !serverIp.trim() || !username.trim() || initialPassword.length < 12 || !Number.isInteger(Number(serverPort)) || Number(serverPort) < 1 || Number(serverPort) > 65535}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar entrega</Button>
    </div>}
    <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-sm">
      <thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-3">Cliente</th><th className="p-3">Plano</th><th className="p-3">Valor</th><th className="p-3">Pagamento</th><th className="p-3">Compra</th><th className="p-3">Entrega</th><th className="p-3">Ação</th></tr></thead>
      <tbody>{loading ? <tr><td className="p-5 text-center" colSpan={7}>Carregando pedidos…</td></tr> :
        orders.length === 0 ? <tr><td className="p-8 text-center text-muted-foreground" colSpan={7}>Nenhum pedido VPS cadastrado. Os pedidos só aparecerão quando o checkout registrar a compra confirmada no banco.</td></tr> :
        orders.map(order => <tr key={order.id} className="border-t border-border">
          <td className="p-3"><div className="font-medium">{order.profile?.display_name || order.profile?.full_name || "Cliente"}</div><div className="text-xs text-muted-foreground">{order.profile?.email ?? order.user_id}</div></td>
          <td className="p-3"><div>{order.plan_name}</div><div className="text-xs uppercase text-muted-foreground">{order.cpu_brand}</div></td>
          <td className="p-3">{money(order.amount_cents)}</td>
          <td className="p-3">{order.payment_status === "paid" ? <span className="text-emerald-600">Pago</span> : order.payment_status}</td>
          <td className="p-3">{date(order.created_at)}</td>
          <td className="p-3">{order.delivered_at ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" />Entregue</span> : <span className="inline-flex items-center gap-1 text-amber-600"><Clock3 className="h-4 w-4" />Pendente</span>}</td>
          <td className="p-3">{order.delivered_at ? <span className="text-muted-foreground">Concluído</span> : order.payment_status !== "paid" ? <span className="text-muted-foreground">Aguardando pagamento</span> : <Button size="sm" onClick={() => setSelected(order)}>Entregar VPS</Button>}</td>
        </tr>)}
      </tbody></table></div>
  </section>;
}
