import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getMyPartnerArea, submitPartnerServerInfo } from "@/lib/partner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/parceiro")({
  head: () => ({
    meta: [
      { title: "Área do Parceiro — Shadow" },
      {
        name: "description",
        content:
          "Gerencie seu servidor de revenda, acompanhe a instalação feita pela equipe Shadow e o status da gestão mensal.",
      },
      { property: "og:title", content: "Área do Parceiro — Shadow" },
      { property: "og:description", content: "Revenda seus próprios logins e acompanhe seu servidor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnerPage,
});

const KIND_LABEL: Record<string, string> = {
  reseller: "Servidor de Revenda",
  deploy: "Instalação do Servidor",
  managed: "Gestão Mensal",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  pending_setup: "Em preparação",
  expired: "Vencido",
  cancelled: "Cancelado",
  open: "Aberto",
  in_progress: "Em andamento",
  done: "Concluído",
};

function fmtDate(v: string | null) {
  if (!v) return "sem prazo";
  return new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function PartnerPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["partner-area"], queryFn: () => getMyPartnerArea({}) });
  const submit = useServerFn(submitPartnerServerInfo);

  const [kind, setKind] = useState<"reseller" | "deploy" | "managed">("deploy");
  const [serverIp, setServerIp] = useState("");
  const [sshUser, setSshUser] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  const entitlements = data?.entitlements ?? [];
  const requests = data?.requests ?? [];
  const hasAny = entitlements.length > 0;

  useEffect(() => {
    if (!data) return;
    if (data.hasReseller) setKind("reseller");
    else if (data.hasDeploy) setKind("deploy");
    else if (data.hasManaged) setKind("managed");
  }, [data]);

  async function onSubmit() {
    setSending(true);
    try {
      const res: any = await submit({
        data: {
          kind,
          serverIp: serverIp.trim() || null,
          sshUser: sshUser.trim() || null,
          contact: contact.trim() || null,
          notes: notes.trim() || null,
        },
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Dados enviados! Nossa equipe já vai olhar.");
        setNotes("");
        void qc.invalidateQueries({ queryKey: ["partner-area"] });
      }
    } catch (e) {
      toast.error((e as Error)?.message ?? "Não foi possível enviar agora.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// parceria shadow</div>
        <h1 className="mt-1 font-display text-2xl md:text-3xl">Área do Parceiro</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Aqui você acompanha o servidor de revenda, a instalação feita pela nossa equipe e a gestão mensal.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando sua área...
        </div>
      ) : !hasAny ? (
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-8 text-center">
          <Crown className="mx-auto mb-3 h-8 w-8 text-primary/60" />
          <h2 className="font-display text-xl">Você ainda não tem um serviço de parceria</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Alugue um servidor de revenda e venda seus próprios logins ficando com 100% do lucro, ou contrate a nossa
            equipe pra subir e cuidar do seu servidor.
          </p>
          <Button asChild className="mt-6">
            <Link to="/planos">
              Ver os serviços <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {entitlements.map((e: any) => (
            <div
              key={e.id}
              className={cn(
                "rounded-2xl border p-5",
                e.active ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card/40",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-display text-lg">
                  {e.kind === "reseller" ? (
                    <Users className="h-4 w-4 text-primary" />
                  ) : e.kind === "managed" ? (
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  ) : (
                    <Server className="h-4 w-4 text-primary" />
                  )}
                  {KIND_LABEL[e.kind] ?? e.kind}
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase",
                    e.active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {STATUS_LABEL[e.status] ?? e.status}
                </span>
              </div>
              <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div>Início: {fmtDate(e.starts_at)}</div>
                <div>Válido até: {fmtDate(e.expires_at)}</div>
                {e.server_host ? <div className="text-foreground">Servidor: {e.server_host}</div> : null}
                {e.server_notes ? <div className="whitespace-pre-line">{e.server_notes}</div> : null}
              </dl>
              {e.kind === "reseller" && e.active ? (
                <p className="mt-3 rounded-lg border border-primary/20 bg-background/40 p-3 text-xs leading-relaxed">
                  Seu painel de revenda fica no servidor acima: por ele você cria, renova e cancela os logins dos seus
                  clientes. Assim que o endereço aparecer aqui, o acesso já está liberado.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {hasAny ? (
        <section className="mt-10 rounded-2xl border border-border/50 bg-card/40 p-5 md:p-6">
          <h2 className="font-display text-lg">Dados do servidor</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie o endereço e um contato. Nunca peça nem escreva sua senha aqui — a equipe combina o acesso com você
            direto no suporte.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["reseller", "deploy", "managed"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  kind === k ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground",
                )}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input placeholder="IP ou domínio" value={serverIp} onChange={(e) => setServerIp(e.target.value)} />
            <Input placeholder="Usuário de acesso (ex: root)" value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
            <Input placeholder="WhatsApp ou Telegram" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <Textarea
            className="mt-3"
            rows={4}
            placeholder="Conte o que precisa: provedor do servidor, se já tem painel instalado, prazo desejado..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button className="mt-4" onClick={onSubmit} disabled={sending}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Enviar para a equipe
          </Button>
        </section>
      ) : null}

      {requests.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg">Seus atendimentos</h2>
          <div className="space-y-3">
            {requests.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-border/50 bg-card/30 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{KIND_LABEL[r.kind] ?? r.kind}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                {r.server_ip ? <div className="mt-1 text-muted-foreground">Servidor: {r.server_ip}</div> : null}
                {r.notes ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{r.notes}</p> : null}
                {r.staff_notes ? (
                  <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs">
                    Equipe: {r.staff_notes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data?.hasReseller ? <PartnerResellerDesk /> : null}
    </div>

  );
}
