import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Search, RefreshCcw, Copy, Check, ClipboardList, ShieldAlert, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminFindUsers, adminReplaceUserTrial } from "@/lib/admin.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [confirmUser, setConfirmUser] = useState<FoundUser | null>(null);
  const inFlight = useRef(false);
  const [copied, setCopied] = useState<string | null>(null);

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
    // proteção contra clique duplo / requisições concorrentes
    if (inFlight.current || busyId) return;
    inFlight.current = true;
    setBusyId(u.id);
    setConfirmUser(null);
    const label = u.display_name || u.email || "cliente";
    const toastId = toast.loading(`Recriando trial de ${label}...`);
    try {
      const res: any = await replaceFn({ data: { userId: u.id } });
      setResult((prev) => ({ ...prev, [u.id]: { ...res.credentials, expires_at: res.expires_at } }));
      toast.success("Trial recriado com sucesso", {
        id: toastId,
        description: `${label} · user: ${res.credentials.username} · expira ${new Date(res.expires_at).toLocaleString("pt-BR")}`,
      });
      await search();
    } catch (err: any) {
      const raw = String(err?.message ?? "");
      const msg = /painel|yaarsa/i.test(raw)
        ? "O painel recusou a criação. Verifique se o usuário antigo foi removido e tente de novo."
        : /rede|fetch|network|timeout/i.test(raw)
          ? "Falha de conexão com o painel. Nenhuma alteração foi aplicada — tente novamente."
          : raw || "Falha ao recriar o trial";
      toast.error("Não foi possível recriar o trial", { id: toastId, description: msg });
    } finally {
      setBusyId(null);
      inFlight.current = false;
    }
  }

  async function copy(text: string, label: string, key?: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback para navegadores/contextos sem Clipboard API
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand falhou");
      }
      if (key) {
        setCopied(key);
        window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
      }
      toast.success(`${label} copiado`);
    } catch {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}`, {
        description: "Selecione o texto manualmente e use Ctrl+C.",
      });
    }
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
                  disabled={!!busyId}
                  onClick={() => setConfirmUser(u)}
                  className="shrink-0 font-mono text-[11px] uppercase"
                >
                  {busyId === u.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
                  Novo trial
                </Button>
              </div>

              {creds && (
                <div className="mt-3 rounded border border-neon/30 bg-neon/5 p-3 font-mono text-[11px]">
                  <div className="uppercase tracking-wider text-neon">// novas credenciais</div>
                  <div className="mt-2 grid gap-1.5">
                    {([
                      ["user", creds.username, "Usuário"],
                      ["email", creds.email, "E-mail"],
                      ["senha", creds.password, "Senha"],
                    ] as const).map(([field, value, label]) => {
                      const key = `${u.id}:${field}`;
                      return (
                        <div key={field} className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-muted-foreground">{field}:</span>
                          <input
                            readOnly
                            value={value}
                            onFocus={(e) => e.currentTarget.select()}
                            aria-label={`${label} gerado`}
                            className="min-w-0 flex-1 rounded border border-border/50 bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:border-neon/60"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Copiar ${label.toLowerCase()}`}
                            className="h-7 w-7 shrink-0 p-0"
                            onClick={() => copy(value, label, key)}
                          >
                            {copied === key ? <Check className="h-3.5 w-3.5 text-neon" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      );
                    })}
                    <div className="text-muted-foreground">expira: {new Date(creds.expires_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="font-mono text-[10px] uppercase"
                      onClick={() => copy(`user: ${creds.username}\nemail: ${creds.email}\npass: ${creds.password}`, "Credenciais", `${u.id}:all`)}
                    >
                      {copied === `${u.id}:all` ? <Check className="mr-1 h-3 w-3 text-neon" /> : <Copy className="mr-1 h-3 w-3" />} Copiar tudo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="font-mono text-[10px] uppercase"
                      onClick={() =>
                        copy(
                          `Prontinho! Aqui está o seu novo teste grátis 👇\n\nUsuário: ${creds.username}\nE-mail: ${creds.email}\nSenha: ${creds.password}\nVálido até: ${new Date(creds.expires_at).toLocaleString("pt-BR")}\n\nQualquer dúvida é só responder por aqui.`,
                          "Mensagem para o cliente",
                          `${u.id}:msg`,
                        )
                      }
                    >
                      {copied === `${u.id}:msg` ? <Check className="mr-1 h-3 w-3 text-neon" /> : <ClipboardList className="mr-1 h-3 w-3" />} Mensagem pronta
                    </Button>
                  </div>
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

      <AlertDialog open={!!confirmUser} onOpenChange={(open) => { if (!open && !busyId) setConfirmUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar um trial novo?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Cliente: <span className="font-mono text-foreground">{confirmUser?.display_name || confirmUser?.email || confirmUser?.id}</span>
                </p>
                {confirmUser?.trial ? (
                  <p className="text-amber-400">
                    O trial atual (<span className="font-mono">{confirmUser.trial.yaarsa_username}</span>) será removido do painel e não poderá ser recuperado.
                  </p>
                ) : (
                  <p>Este cliente não tem trial registrado — um novo será criado.</p>
                )}
                <p>Novas credenciais de 24h serão geradas e exibidas aqui.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId} className="font-mono text-xs uppercase">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!busyId}
              onClick={(e) => { e.preventDefault(); if (confirmUser) void replaceTrial(confirmUser); }}
              className="font-mono text-xs uppercase"
            >
              {busyId ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Confirmar e gerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
