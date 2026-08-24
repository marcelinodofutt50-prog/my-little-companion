import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminListThreads, adminAssumeThread, adminCloseThread } from "@/lib/admin.functions";
import { Loader2 } from "lucide-react";
import { adminSetThreadPriority, adminUpdateThreadCategory, adminMergeDuplicateThreads } from "@/lib/support-admin.functions";
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
  ShieldCheck
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

export function AdminSupportPanel() {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "mine" | "closed" | "all">("open");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const listFn = useServerFn(adminListThreads);
  const assumeFn = useServerFn(adminAssumeThread);
  const closeFn = useServerFn(adminCloseThread);
  const setPriorityFn = useServerFn(adminSetThreadPriority);
  const setCategoryFn = useServerFn(adminUpdateThreadCategory);
  const mergeFn = useServerFn(adminMergeDuplicateThreads);
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

  const loadThreads = async () => {
    setLoading(true);
    try {
      const data: any = await listFn({ data: { filter } });
      setThreads(data);
    } catch (e: any) {
      toast.error("Erro ao listar tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));

    const ch = supabase.channel("admin-chat-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" }, () => loadThreads())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, () => loadThreads())
      .subscribe();
      
    return () => { supabase.removeChannel(ch); };
  }, [filter]);

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t => 
      t.subject?.toLowerCase().includes(q) || 
      t.profile?.email?.toLowerCase().includes(q) ||
      t.profile?.display_name?.toLowerCase().includes(q)
    );
  }, [threads, search]);

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
              className="pl-8 h-9 text-xs bg-background/40"
            />
          </div>
          <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
            {(["open", "mine", "closed"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1 text-[10px] font-mono uppercase rounded-md transition-all ${
                  filter === f ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                {f === "mine" ? "Meus" : f === "open" ? "Abertos" : "Fim"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border/40">
          {loading && threads.length === 0 ? (
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
                      {t.assigned_to === myId && (
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      )}
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
              />
            </div>

            <div className="p-2 border-t border-border/20 bg-muted/10 flex flex-wrap items-center justify-between gap-2">

              <QuickRepliesDropdown onPick={(body) => {
                // Aqui injetamos no input do chat se pudermos, ou enviamos direto
                // Como o SupportChat é desacoplado, poderíamos usar um canal de ref ou similar
                // Por simplicidade, vamos apenas mostrar as respostas
                toast.info("Respostas rápidas prontas para uso");
              }} />
              
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
    </div>
  );
}
