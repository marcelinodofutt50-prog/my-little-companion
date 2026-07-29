import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGlobalSearch } from "@/lib/admin.functions";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, User, Receipt, ShieldCheck, MessageSquare, Loader2 } from "lucide-react";

type Result = { users: any[]; orders: any[]; licenses: any[]; threads: any[] };
const EMPTY: Result = { users: [], orders: [], licenses: [], threads: [] };

const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;

export function AdminGlobalSearch({
  onSelectUser,
  onOpenThread,
}: {
  onSelectUser: (userId: string) => void;
  onOpenThread?: (threadId: string) => void;
}) {
  const search = useServerFn(adminGlobalSearch);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setRes(EMPTY); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setRes(await search({ data: { q: term } }));
      } catch {
        setRes(EMPTY);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  const total = useMemo(
    () => res.users.length + res.orders.length + res.licenses.length + res.threads.length,
    [res],
  );

  const pickUser = (id: string) => { setOpen(false); onSelectUser(id); };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar cliente, pedido, licença…</span>
        <kbd className="hidden rounded border border-border/60 px-1 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Busca global do admin</DialogTitle>
          <DialogDescription className="sr-only">Busque clientes, pedidos, licenças e tickets</DialogDescription>
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Search className="h-4 w-4 text-muted-foreground" />}
            <input
              ref={inputRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="E-mail, nome, ID do pedido, login Yaarsa, assunto…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length < 2 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Digite ao menos 2 caracteres.</p>
            ) : total === 0 && !loading ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Nenhum resultado para “{q}”.</p>
            ) : (
              <div className="space-y-3">
                {res.users.length > 0 && (
                  <Group icon={User} title="Clientes">
                    {res.users.map((u) => (
                      <Row key={u.id} onClick={() => pickUser(u.id)}
                        main={u.display_name || u.full_name || u.email}
                        sub={u.email} />
                    ))}
                  </Group>
                )}
                {res.orders.length > 0 && (
                  <Group icon={Receipt} title="Pedidos">
                    {res.orders.map((o) => (
                      <Row key={o.id} onClick={() => pickUser(o.user_id)}
                        main={`${o.plan_slug} · ${brl(o.amount)}`}
                        sub={new Date(o.created_at).toLocaleString("pt-BR")}
                        tag={o.status} />
                    ))}
                  </Group>
                )}
                {res.licenses.length > 0 && (
                  <Group icon={ShieldCheck} title="Licenças">
                    {res.licenses.map((l) => (
                      <Row key={l.id} onClick={() => pickUser(l.user_id)}
                        main={l.yaarsa_email}
                        sub={`${l.plan_slug} · ${l.panel}`}
                        tag={l.revoked ? "revogada" : "ativa"} />
                    ))}
                  </Group>
                )}
                {res.threads.length > 0 && (
                  <Group icon={MessageSquare} title="Tickets">
                    {res.threads.map((t) => (
                      <Row key={t.id}
                        onClick={() => { setOpen(false); onOpenThread ? onOpenThread(t.id) : onSelectUser(t.user_id); }}
                        main={t.subject}
                        sub={t.category}
                        tag={t.status} />
                    ))}
                  </Group>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Group({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ main, sub, tag, onClick }: { main: string; sub?: string; tag?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm">{main}</span>
        {sub && <span className="block truncate font-mono text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      {tag && <Badge variant="secondary" className="shrink-0 text-[10px]">{tag}</Badge>}
    </button>
  );
}
