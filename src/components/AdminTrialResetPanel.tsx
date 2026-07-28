import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Search, RefreshCcw, Copy, ShieldAlert, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminFindUsers, adminReplaceUserTrial } from "@/lib/admin.functions";

type FoundUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  created_at: string;
  trial: {
    yaarsa_username: string;
    yaarsa_email: string;
    expires_at: string | null;
    revoked: boolean;
    disabled_at: string | null;
  } | null;
};

type NewCreds = { username: string; email: string; password: string };

export function AdminTrialResetPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<FoundUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, NewCreds & { expires_at: string }>>({});

  const findFn = useServerFn(adminFindUsers);
  const replaceFn = useServerFn(adminReplaceUserTrial);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 2) { toast.info("Digite ao menos 2 caracteres"); return; }
    setLoading(true);
    try {
      const res = (await findFn({ data: { query: query.trim() } })) as FoundUser[];
      setUsers(res);
      if (!res.length) toast.info("Nenhum cliente encontrado");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha na busca");
    }
    setLoading(false);
  }

  async function replaceTrial(u: FoundUser) {
    const label = u.display_name || u.email || u.id;
    if (!confirm(`Gerar um trial NOVO para ${label}? O trial atual (se existir) será removido do painel.`)) return;
    setBusyId(u.id);
    try {
      const res: any = await replaceFn({ data: { userId: u.id } });
      setResult((prev) => ({ ...prev, [u.id]: { ...res.credentials, expires_at: res.expires_at } }));
      toast.success("Trial recriado com sucesso", { description: `user: ${res.credentials.username}` });
      await search();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao recriar o trial");
    }
    setBusyId(null);
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-neon">
        <RefreshCcw className="h-3.5 w-3.5" /> reset de trial
      </div>
      <h3 className="mt-1 text-base font-semibold">Gerar novo trial para um cliente</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Busque por apelido, e-mail, nome ou usuário do painel. O trial antigo é removido do servidor e substituído por credenciais novas.
      </p>

      <form onSubmit={search} className="mt-3 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="apelido, e-mail ou usuário do painel"
          className="font-mono text-xs"
        />
        <Button type="submit" disabled={loading} size="sm" className="shrink-0 font-mono text-xs uppercase">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          <span className="ml-1.5 hidden sm:inline">Buscar</span>
        </Button>
      </form>

      <div className="mt-4 space-y-3">
        {users.map((u) => {
          const creds = result[u.id];
          const trialExpired = !!u.trial?.expires_at && new Date(u.trial.expires_at).getTime() <= Date.now();
          return (
            <div key={u.id} className="rounded border border-border/50 bg-background/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate font-mono text-xs text-foreground">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {u.display_name || u.full_name || "sem apelido"}
                  </div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">{u.email}</div>
                  <div className="mt-1 font-mono text-[10px]">
                    {u.trial ? (
                      <span className={trialExpired || u.trial.revoked || u.trial.disabled_at ? "text-amber-400" : "text-neon"}>
                        trial atual: {u.trial.yaarsa_username}
                        {u.trial.expires_at ? ` · expira ${new Date(u.trial.expires_at).toLocaleString("pt-BR")}` : ""}
                        {trialExpired ? " · expirado" : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">sem trial registrado</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === u.id}
                  onClick={() => replaceTrial(u)}
                  className="shrink-0 font-mono text-[11px] uppercase"
                >
                  {busyId === u.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
                  Novo trial
                </Button>
              </div>

              {creds && (
                <div className="mt-3 rounded border border-neon/30 bg-neon/5 p-3 font-mono text-[11px]">
                  <div className="uppercase tracking-wider text-neon">// novas credenciais</div>
                  <div className="mt-1 grid gap-0.5">
                    <div>user: <span className="text-foreground">{creds.username}</span></div>
                    <div>email: <span className="text-foreground">{creds.email}</span></div>
                    <div>senha: <span className="text-foreground">{creds.password}</span></div>
                    <div className="text-muted-foreground">expira: {new Date(creds.expires_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 font-mono text-[10px] uppercase"
                    onClick={() => copy(`user: ${creds.username}\nemail: ${creds.email}\npass: ${creds.password}`, "Credenciais")}
                  >
                    <Copy className="mr-1 h-3 w-3" /> Copiar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {!users.length && !loading && (
          <div className="flex items-center gap-2 rounded border border-dashed border-border/50 p-4 font-mono text-[11px] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> Nenhum resultado — faça uma busca acima.
          </div>
        )}
      </div>
    </div>
  );
}
