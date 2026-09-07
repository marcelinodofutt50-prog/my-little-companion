import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, Loader2, Server } from "lucide-react";
import { adminListPartners, adminRevealPartnerServerPassword } from "@/lib/partner.functions";
import { Button } from "@/components/ui/button";

const KIND_LABEL: Record<string, string> = {
  reseller: "Servidor de Revenda",
  deploy: "Instalação do Servidor",
  managed: "Gestão Mensal",
};

/** Chamados de parceria: dados da VPS enviados pelo cliente e acessos ativos. */
export function AdminPartnersPanel() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-partners"],
    queryFn: () => adminListPartners({}),
  });
  const reveal = useServerFn(adminRevealPartnerServerPassword);
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});

  async function onReveal(requestId: string) {
    setBusy(requestId);
    try {
      const res: any = await reveal({ data: { requestId } });
      if (res?.error) toast.error(res.error);
      else setShown((s) => ({ ...s, [requestId]: res.password }));
    } catch (e) {
      toast.error((e as Error)?.message ?? "Não foi possível abrir agora.");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando parceiros...
      </div>
    );
  }

  const requests = ((data as any)?.requests ?? []) as any[];
  const profiles = ((data as any)?.profiles ?? []) as any[];
  const nameOf = (userId: string) => {
    const p = profiles.find((x: any) => x.id === userId);
    return p?.display_name || p?.email || userId.slice(0, 8);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg">
            <Server className="h-4 w-4 text-primary" /> Parceiros & VPS
          </h2>
          <p className="text-sm text-muted-foreground">
            Dados de acesso que o cliente enviou para a equipe subir ou cuidar do servidor.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Atualizar
        </Button>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum chamado de parceria por enquanto.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border/50 bg-card/40 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{nameOf(r.user_id)}</div>
                  <div className="text-xs text-muted-foreground">
                    {KIND_LABEL[r.kind] ?? r.kind} · {r.status} ·{" "}
                    {r.form_submitted_at
                      ? `dados enviados em ${new Date(r.form_submitted_at).toLocaleString("pt-BR")}`
                      : "aguardando dados da VPS"}
                  </div>
                </div>
              </div>

              <div className="mt-2 grid gap-1 font-mono text-xs text-muted-foreground">
                <span>IP: {r.server_ip || "—"}</span>
                <span>Usuário: {r.ssh_user || "—"}</span>
                <span>Senha: {shown[r.id] ? shown[r.id] : r.ssh_password_enc ? "••••••••" : "não informada"}</span>
                <span>Contato: {r.contact || "—"}</span>
              </div>

              {r.notes ? <p className="mt-2 whitespace-pre-line text-muted-foreground">{r.notes}</p> : null}

              {r.ssh_password_enc && !shown[r.id] ? (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => onReveal(r.id)} disabled={busy === r.id}>
                  {busy === r.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                  Ver senha
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
