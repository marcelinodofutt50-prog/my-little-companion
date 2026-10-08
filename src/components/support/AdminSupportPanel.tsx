import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminListThreads, adminAssumeThread, adminCloseThread, adminHealUserLogins } from "@/lib/admin.functions";
import { Loader2, History } from "lucide-react";
import { adminSetThreadPriority, adminUpdateThreadCategory, adminMergeDuplicateThreads, adminSearchSupportHistory } from "@/lib/support-admin.functions";
import { SupportChat } from "./SupportChat";
import { SupportCustomerContext } from "@/components/SupportCustomerContext";
import { AdminCustomer360 } from "@/components/admin/lazy-panels";
import { QuickRepliesDropdown } from "@/components/QuickRepliesDropdown";
import { categoryMeta, SUPPORT_CATEGORY_META, SupportCategory } from "@/lib/support-categories";
import { 
  Search, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  User, 
  ChevronRight,
  Filter,
  AlertCircle,
  Hash,
  ShieldCheck,
  Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { playNotifyDing, requestNotifyPermission, showDesktopNotification } from "@/lib/notify-sound";

export function AdminSupportPanel() {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "mine" | "closed" | "all">("open");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [prioFilter, setPrioFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [fichaUserId, setFichaUserId] = useState<string | null>(null);
  const [healing, setHealing] = useState(false);
  const [draft, setDraft] = useState<{ text: string; nonce: number } | null>(null);
  const [historyMode, setHistoryMode] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyResults, setHistoryResults] = useState<any[] | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [histStatus, setHistStatus] = useState<"all" | "open" | "closed">("all");
  const [histDays, setHistDays] = useState(0);
  const [histWho, setHistWho] = useState<"all" | "customer" | "staff">("all");

  const searchHistoryFn = useServerFn(adminSearchSupportHistory);

  /** Busca o termo no conteúdo de TODAS as mensagens antigas (inclusive tickets encerrados). */
  const handleHistorySearch = async (
    over: { status?: "all" | "open" | "closed"; days?: number; who?: "all" | "customer" | "staff" } = {},
  ) => {
    const q = search.trim();
    if (q.length < 2) {
      toast.error("Digite pelo menos 2 letras para buscar no histórico.");
      return;
    }
    setHistoryMode(true);
    setHistoryLoading(true);
    setHistoryQuery(q);
    try {
      const res: any = await searchHistoryFn({ data: {
        query: q,
        status: over.status ?? histStatus,
        days: over.days ?? histDays,
        who: over.who ?? histWho,
      } });
      setHistoryResults(res?.results ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao buscar no histórico");
      setHistoryResults([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const exitHistoryMode = () => {
    setHistoryMode(false);
    setHistoryResults(null);
  };

  /** Abre uma conversa encontrada no histórico, mesmo que não esteja na lista atual. */
  const openHistoryThread = async (threadId: string) => {
    if (!threads.some((t) => t.id === threadId)) {
      try {
        const all: any = await listFn({ data: { filter: "all" } });
        setThreads((prev) => {
          const merged = [...prev];
          for (const t of all ?? []) {
            if (!merged.some((x) => x.id === t.id)) merged.push(t);
          }
          return merged;
        });
      } catch {}
    }
    setSelectedId(threadId);
  };

  const listFn = useServerFn(adminListThreads);
  const assumeFn = useServerFn(adminAssumeThread);
  const closeFn = useServerFn(adminCloseThread);
  const setPriorityFn = useServerFn(adminSetThreadPriority);
  const setCategoryFn = useServerFn(adminUpdateThreadCategory);
  const mergeFn = useServerFn(adminMergeDuplicateThreads);
  const healUserFn = useServerFn(adminHealUserLogins);

  /** Corrige os logins (BTmob/Yaarsa) do cliente dono deste ticket. */
  const handleHealBugs = async (userId: string) => {
    if (!userId) return;
    setHealing(true);
    try {
      const res: any = await healUserFn({ data: { userId } });
      const failed = (res?.healed ?? []).filter((h: any) => h.action === "failed");
      const desc = (res?.healed ?? [])
        .map((h: any) => `${h.panel}: ${h.action === "recreated" ? `novo login ${h.credentials?.email}` : h.action === "created" ? "conta criada no painel" : h.action === "failed" ? h.error ?? "falhou" : "já estava OK"}`)
        .join(" • ");
      if (failed.length > 0 && failed.length === (res?.healed ?? []).length) {
        toast.error(res?.message ?? "Não foi possível corrigir.", { description: desc });
      } else {
        toast.success(res?.message ?? "Correção concluída.", { description: desc || undefined });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao corrigir os bugs deste cliente.");
    } finally {
      setHealing(false);
    }
  };
  const [merging, setMerging] = useState(false);

  const handleMergeDuplicates = async () => {
    setMerging(true);
    try {
      const res: any = await mergeFn({});
      toast.success(
        res.merged
          ? `${res.merged} ticket(s) duplicado(s) unificados em ${res.users} conversa(s).`
          : "Nenhum ticket duplicado encontrado.",
      );
      setSelectedId(null);
      loadThreads();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao unificar tickets");
    } finally {
      setMerging(false);
    }
  };

  const loadThreads = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data: any = await listFn({ data: { filter } });
      setThreads(data);
    } catch (e: any) {
      if (!silent) toast.error("Erro ao listar tickets");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
    try { requestNotifyPermission(); } catch {}
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));

    // Vários eventos em sequência (mensagem + atualização do ticket) viram UMA
    // recarga silenciosa — antes cada evento refazia a lista inteira e piscava.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void loadThreads(true); }, 900);
    };

    const ch = supabase.channel("admin-chat-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" }, () => scheduleReload())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload: any) => {
        scheduleReload();
        const m = payload?.new;
        if (m && !m.is_admin && !m.is_system) {
          const preview = String(m.body ?? m.content ?? "Nova mensagem").slice(0, 80);
          try { playNotifyDing(); } catch {}
          try { showDesktopNotification("Nova mensagem no suporte", preview); } catch {}
          toast.info("Nova mensagem de cliente", { description: preview, action: { label: "Abrir", onClick: () => setSelectedId(m.thread_id) } });
        }
      })
      .subscribe();

    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(ch); };
  }, [filter]);

  // Contador de não lidas no título da aba do navegador.
  const unreadTotal = threads.reduce((n, t) => n + (Number(t.unread_by_staff || 0) > 0 ? 1 : 0), 0);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unreadTotal > 0 ? `(${unreadTotal}) ${base}` : base;
    return () => { document.title = document.title.replace(/^\(\d+\)\s*/, ""); };
  }, [unreadTotal]);

  const filteredThreads = useMemo(() => {
    const rank: Record<string, number> = { critica: 0, alta: 1, normal: 2 };
    const q = search.trim().toLowerCase();
    return threads
      .filter(t => catFilter === "all" || (t.category || "outro") === catFilter)
      .filter(t => prioFilter === "all" || (t.priority || "normal") === prioFilter)
      .filter(t => !q ||
        t.subject?.toLowerCase().includes(q) ||
        t.profile?.email?.toLowerCase().includes(q) ||
        t.profile?.display_name?.toLowerCase().includes(q))
      .slice()
      .sort((a, b) =>
        (Number(b.unread_by_staff || 0) > 0 ? 1 : 0) - (Number(a.unread_by_staff || 0) > 0 ? 1 : 0) ||
        (rank[a.priority || "normal"] ?? 2) - (rank[b.priority || "normal"] ?? 2));
  }, [threads, search, catFilter, prioFilter]);

  const selectedThread = threads.find(t => t.id === selectedId);

  const handleAssume = async (id: string) => {
    try {
      await assumeFn({ data: { threadId: id } });
      toast.success("Ticket assumido com sucesso");
      loadThreads();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleClose = async (id: string) => {
    try {
      await closeFn({ data: { threadId: id } });
      toast.success("Ticket encerrado");
      setSelectedId(null);
      loadThreads();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100dvh-12rem)] min-h-[520px] md:h-[calc(100vh-9rem)] md:min-h-[620px] bg-card/30 border border-border/40 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Sidebar de Tickets */}
      <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0 min-h-0 flex-col border-b md:border-b-0 md:border-r border-border/40 bg-background/40`}>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-widest text-neon">// Tickets</h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleMergeDuplicates}
                disabled={merging}
                className="h-7 px-2 text-[10px] font-mono uppercase"
                title="Unificar tickets duplicados do mesmo cliente"
              >
                {merging ? <Loader2 className="h-3 w-3 animate-spin" /> : "Unificar"}
              </Button>
              <Badge variant="outline" className="font-mono">{threads.length}</Badge>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar cliente ou assunto..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void handleHistorySearch(); }}
              className="pl-8 h-9 text-xs bg-background/40"
            />
          </div>
          {historyMode ? (
            <div className="space-y-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={exitHistoryMode}
              className="w-full h-8 text-[10px] font-mono uppercase border-neon/40 text-neon"
            >
              ← Voltar para os tickets
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Select value={histStatus} onValueChange={(v) => { setHistStatus(v as any); handleHistorySearch({ status: v as any }); }}>
                <SelectTrigger className="h-8 text-[10px] font-mono uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abertos</SelectItem>
                  <SelectItem value="closed">Encerrados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(histDays)} onValueChange={(v) => { setHistDays(Number(v)); handleHistorySearch({ days: Number(v) }); }}>
                <SelectTrigger className="h-8 text-[10px] font-mono uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="0">Sempre</SelectItem>
                </SelectContent>
              </Select>
              <Select value={histWho} onValueChange={(v) => { setHistWho(v as any); handleHistorySearch({ who: v as any }); }}>
                <SelectTrigger className="h-8 text-[10px] font-mono uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="staff">Equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!historyLoading && historyResults && (
              <div className="text-[10px] font-mono text-muted-foreground uppercase">
                {historyResults.length} conversa(s) encontrada(s)
              </div>
            )}
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleHistorySearch()}
              disabled={historyLoading || search.trim().length < 2}
              className="w-full h-8 text-[10px] font-mono uppercase"
              title="Procura o termo no conteúdo de todas as mensagens, inclusive de tickets encerrados"
            >
              {historyLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <History className="h-3 w-3 mr-1" />}
              Buscar no histórico de mensagens
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="h-8 text-[10px] font-mono uppercase"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {SUPPORT_CATEGORY_META.map(c => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={prioFilter} onValueChange={setPrioFilter}>
              <SelectTrigger className="h-8 text-[10px] font-mono uppercase"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda prioridade</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
            {(["open", "mine", "closed", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1 text-[10px] font-mono uppercase rounded-md transition-all ${
                  filter === f ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                {f === "mine" ? "Meus" : f === "open" ? "Abertos" : f === "closed" ? "Fim" : "Todos"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border/40">
          {historyMode ? (
            historyLoading ? (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <span className="text-[10px] font-mono uppercase">Buscando no histórico...</span>
              </div>
            ) : !historyResults || historyResults.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic text-xs">
                Nenhuma conversa antiga encontrada com esse termo
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {historyResults.map((r) => (
                  <button
                    key={r.thread_id}
                    onClick={() => openHistoryThread(r.thread_id)}
                    className="w-full text-left p-4 transition-all hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono text-muted-foreground uppercase">
                        #{r.thread_id.slice(0, 8)} • {new Date(r.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {r.status === "closed" ? "Encerrado" : r.status}
                      </Badge>
                    </div>
                    <div className="font-semibold text-sm truncate mb-0.5">{r.subject}</div>
                    <div className="text-xs text-muted-foreground truncate mb-2">
                      {r.email || r.display_name || "Usuário anônimo"}
                    </div>
                    <div className="space-y-1">
                      {r.snippets.map((s: any) => (
                        <div key={s.id} className="text-[11px] leading-snug text-muted-foreground bg-muted/30 border border-border/30 rounded px-2 py-1">
                          <span className={`font-mono text-[9px] uppercase mr-1 ${s.is_admin ? "text-primary" : "text-neon"}`}>
                            {s.is_admin ? "Equipe" : "Cliente"}:
                          </span>
                          {highlight(s.snippet, historyQuery)}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : loading && threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <span className="text-[10px] font-mono uppercase">Sincronizando...</span>
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground italic text-xs">
              Nenhum ticket encontrado
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {filteredThreads.map(t => {
                const isSelected = selectedId === t.id;
                const unread = Number(t.unread_by_staff || 0);
                const priority = t.priority || "normal";
                const cat = categoryMeta(t.category);
                
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left p-4 transition-all hover:bg-muted/30 relative ${
                      isSelected ? "bg-primary/10 border-r-2 border-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono text-muted-foreground uppercase">
                        #{t.id.slice(0, 8)} • {new Date(t.updated_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {unread > 0 && (
                        <Badge className="bg-neon text-neon-foreground animate-pulse text-[9px] h-4 min-w-[16px] px-1">
                          {unread}
                        </Badge>
                      )}
                    </div>
                    <div className="font-semibold text-sm truncate mb-1 flex items-center gap-1.5">
                      {priority === "alta" && <AlertCircle className="h-3 w-3 text-amber-500" />}
                      {priority === "critica" && <AlertCircle className="h-3 w-3 text-destructive animate-bounce" />}
                      {t.subject}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mb-2">
                      {t.profile?.email || "Usuário anônimo"}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border/40">
                          {cat.emoji} {cat.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                      {unread > 0 ? (
                        <span className="text-[9px] font-mono uppercase text-neon">Não visto pela equipe</span>
                      ) : Number(t.unread_by_customer || 0) > 0 ? (
                        <span className="text-[9px] font-mono uppercase text-muted-foreground">Cliente não viu</span>
                      ) : (
                        <span className="text-[9px] font-mono uppercase text-sky-400">Visto</span>
                      )}
                      {t.assigned_to === myId && (
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Área de Chat */}
      <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 min-w-0 min-h-0 flex-col bg-background/20 relative`}>
        {selectedThread ? (
          <>
            {/* Header do Chat */}
            <div className="p-3 sm:p-4 border-b border-border/40 bg-background/60 backdrop-blur-md z-10">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:flex md:items-center md:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Voltar para a lista de tickets"
                    className="h-8 w-8 shrink-0 md:hidden"
                    onClick={() => setSelectedId(null)}
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </Button>
                  <div className="min-w-0">
                  <h3 className="font-bold text-base sm:text-lg flex items-center gap-2 min-w-0">
                    <span className="truncate">{selectedThread.subject}</span>
                    {selectedThread.priority === "alta" && <Badge className="shrink-0 bg-amber-500/20 text-amber-500 border-amber-500/40">ALTA</Badge>}
                    {selectedThread.priority === "critica" && <Badge variant="destructive" className="shrink-0">CRÍTICA</Badge>}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 min-w-0">
                    <User className="h-3 w-3 shrink-0" /> <span className="truncate">{selectedThread.profile?.email}</span>
                    {selectedThread.assigned_name && (
                      <span className="hidden sm:flex items-center gap-1 text-primary/80 truncate">
                        • Assumido por {selectedThread.assigned_name}
                      </span>
                    )}
                  </p>
                  </div>
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:flex-nowrap">

                  <Select 
                    value={selectedThread.priority} 
                    onValueChange={val => setPriorityFn({ data: { threadId: selectedThread.id, priority: val as any } }).then(() => loadThreads())}
                  >
                    <SelectTrigger className="w-24 h-8 text-[10px] font-mono">
                      <SelectValue placeholder="Prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={selectedThread.category} 
                    onValueChange={val => setCategoryFn({ data: { threadId: selectedThread.id, category: val as any } }).then(() => loadThreads())}
                  >
                    <SelectTrigger className="w-32 h-8 text-[10px] font-mono">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORT_CATEGORY_META.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={healing}
                    className="h-8 font-mono text-[10px] uppercase border-cyan-500/40 text-cyan-400 hover:text-cyan-300"
                    onClick={() => handleHealBugs(selectedThread.user_id)}
                  >
                    {healing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wrench className="h-3 w-3 mr-1" />}
                    Corrigir Bugs
                  </Button>

                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-8 font-mono text-[10px] uppercase"
                    onClick={() => handleClose(selectedThread.id)}
                  >
                    Encerrar
                  </Button>
                </div>
              </div>
            </div>

            <SupportCustomerContext 
              userId={selectedThread.user_id} 
              email={selectedThread.profile?.email}
              onOpenFicha={() => setFichaUserId(selectedThread.user_id)}
            />

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <SupportChat 
                threadId={selectedThread.id} 
                userId={myId || ""} 
                isAdmin={true} 
                customerName={selectedThread.profile?.display_name || selectedThread.profile?.email || "Cliente"} 
                insertDraft={draft}
              />
            </div>

            <div className="p-2 border-t border-border/20 bg-muted/10 flex flex-wrap items-center justify-between gap-2">

              <QuickRepliesDropdown
                onPick={(body) =>
                  setDraft({ text: body, nonce: Date.now() })
                }
              />
              
              {!selectedThread.assigned_to && (
                <Button 
                  size="sm" 
                  className="bg-neon text-neon-foreground hover:bg-neon/80 font-mono text-[10px] uppercase"
                  onClick={() => handleAssume(selectedThread.id)}
                >
                  <ShieldCheck className="h-3 w-3 mr-2" /> Assumir Ticket
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-[radial-gradient(circle_at_center,_var(--neon)_0%,_transparent_50%)] opacity-20">
            <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
            <h3 className="text-xl font-mono uppercase tracking-[0.2em] mb-2 text-foreground">Central de Atendimento</h3>
            <p className="max-w-xs text-sm">Selecione um ticket na barra lateral para iniciar o atendimento tático.</p>
          </div>
        )}
      </div>

      {fichaUserId && (
      <AdminCustomer360
        userId={fichaUserId}
        onClose={() => setFichaUserId(null)}
        onOpenThread={(threadId: string) => {
          setFichaUserId(null);
          setSelectedId(threadId);
        }}
      />
      )}
    </div>
  );
}

/** Destaca o termo buscado dentro do trecho (sem diferenciar maiúsculas). */
function highlight(text: string, term: string) {
  if (!term) return text;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = String(text).split(new RegExp(`(${esc})`, "ig"));
  return parts.map((p, i) =>
    p.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{p}</mark>
      : <span key={i}>{p}</span>,
  );
}
