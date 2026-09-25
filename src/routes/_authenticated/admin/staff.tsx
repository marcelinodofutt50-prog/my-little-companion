import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, History, ClipboardList, CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SiteHeader } from "@/components/SiteHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { staffListApplications, staffUpdateApplication, staffListMembers, staffListAudit } from "@/lib/staff-admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({
    meta: [
      { title: "Equipe — Painel Admin Shadow" },
      { name: "description", content: "Gerencie membros da equipe, candidaturas e auditoria." },
      { property: "og:title", content: "Equipe — Painel Admin Shadow" },
      { property: "og:description", content: "Gerencie membros da equipe, candidaturas e auditoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminStaffPage,
});

const fmt = (d: string) => format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
const nameOf = (p: any, fallback?: string) => p?.display_name || p?.full_name || p?.email || fallback || "—";

function StateBox({ children }: { children: React.ReactNode }) {
  return <div className="py-12 text-center font-mono text-[10px] uppercase text-muted-foreground">{children}</div>;
}

function AdminStaffPage() {
  const qc = useQueryClient();
  const listApps = useServerFn(staffListApplications);
  const updateApp = useServerFn(staffUpdateApplication);
  const listMembers = useServerFn(staffListMembers);
  const listAudit = useServerFn(staffListAudit);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const apps = useQuery({ queryKey: ["staff-applications"], queryFn: () => listApps() });
  const members = useQuery({ queryKey: ["staff-members"], queryFn: () => listMembers() });
  const audit = useQuery({ queryKey: ["staff-audit"], queryFn: () => listAudit() });

  const mutate = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) => updateApp({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Candidatura aprovada" : "Candidatura rejeitada");
      qc.invalidateQueries({ queryKey: ["staff-applications"] });
      qc.invalidateQueries({ queryKey: ["staff-audit"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao atualizar"),
  });

  const all = (apps.data ?? []) as any[];
  const pending = all.filter((a) => !a.status || a.status === "pending" || a.status === "under_review");
  const shown = filter === "pending" ? pending : all;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <SiteHeader />
          <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground md:text-4xl">Gerenciamento de Equipe</h1>
              <p className="mt-2 text-muted-foreground">Membros, candidaturas e histórico de ações.</p>
            </div>

            <Tabs defaultValue="applications" className="space-y-6">
              <TabsList className="flex-wrap border border-border bg-card/60">
                <TabsTrigger value="applications" className="gap-2">
                  <ClipboardList className="h-4 w-4" /> Candidaturas
                  {pending.length > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px]">{pending.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" /> Membros</TabsTrigger>
                <TabsTrigger value="audit" className="gap-2"><History className="h-4 w-4" /> Auditoria</TabsTrigger>
              </TabsList>

              <TabsContent value="applications">
                <Card className="border-primary/10 bg-card/60">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                      Recrutamento
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Pendentes ({pending.length})</Button>
                        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todas ({all.length})</Button>
                        <Button size="icon" variant="ghost" onClick={() => apps.refetch()} aria-label="Atualizar"><RefreshCw className={`h-4 w-4 ${apps.isFetching ? "animate-spin" : ""}`} /></Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {apps.isLoading ? <StateBox>Carregando candidaturas...</StateBox>
                      : apps.isError ? (
                        <StateBox>
                          Erro: {(apps.error as any)?.message}
                          <div className="mt-3"><Button size="sm" variant="outline" onClick={() => apps.refetch()}>Tentar novamente</Button></div>
                        </StateBox>
                      ) : shown.length === 0 ? <StateBox>Nenhuma candidatura {filter === "pending" ? "pendente" : ""}.</StateBox>
                      : (
                        <div className="space-y-3">
                          {shown.map((app) => {
                            const busy = mutate.isPending && mutate.variables?.id === app.id;
                            const decided = app.status === "approved" || app.status === "rejected";
                            return (
                              <div key={app.id} className="flex flex-col justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/40 md:flex-row md:items-center">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold">{app.full_name || nameOf(app.profile, "Sem nome")}</span>
                                    {app.area && <Badge variant="secondary" className="text-[9px] uppercase">{app.area}</Badge>}
                                    <Badge variant="outline" className="text-[9px] uppercase">{app.status || "pending"}</Badge>
                                  </div>
                                  <div className="font-mono text-[10px] text-muted-foreground">
                                    {app.profile?.email ?? "—"}{app.discord_tag ? ` • Discord: ${app.discord_tag}` : ""} • {fmt(app.created_at)}
                                  </div>
                                  {app.availability && <p className="text-xs text-muted-foreground">Disponibilidade: {app.availability}</p>}
                                  {app.experience && <p className="line-clamp-2 text-xs text-muted-foreground">Experiência: {app.experience}</p>}
                                  <p className="mt-1 line-clamp-3 text-xs italic text-muted-foreground">"{app.motivation || "Sem motivação informada"}"</p>
                                </div>
                                {!decided && (
                                  <div className="flex shrink-0 items-center gap-2">
                                    <Button size="sm" variant="outline" disabled={busy} className="h-8 border-destructive/30 text-[10px] text-destructive hover:bg-destructive/10" onClick={() => mutate.mutate({ id: app.id, status: "rejected" })}>
                                      <XCircle className="mr-1.5 h-3.5 w-3.5" /> REJEITAR
                                    </Button>
                                    <Button size="sm" disabled={busy} className="h-8 text-[10px]" onClick={() => mutate.mutate({ id: app.id, status: "approved" })}>
                                      {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />} APROVAR
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="members">
                <Card className="border-primary/10 bg-card/60">
                  <CardHeader><CardTitle>Equipe Shadow ({members.data?.length ?? 0})</CardTitle></CardHeader>
                  <CardContent>
                    {members.isLoading ? <StateBox>Carregando equipe...</StateBox>
                      : members.isError ? <StateBox>Erro: {(members.error as any)?.message}</StateBox>
                      : !members.data?.length ? <StateBox>Nenhum membro na equipe.</StateBox>
                      : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {members.data.map((m: any) => (
                            <div key={m.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{nameOf(m.profile)}</div>
                                <div className="truncate font-mono text-[10px] text-muted-foreground">{m.profile?.email ?? m.user_id}</div>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                {m.roles.map((r: string) => (
                                  <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-[9px] uppercase">{r === "moderator" ? "suporte" : r}</Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit">
                <Card className="border-primary/10 bg-card/60">
                  <CardHeader><CardTitle>Últimas ações da equipe</CardTitle></CardHeader>
                  <CardContent>
                    {audit.isLoading ? <StateBox>Carregando histórico...</StateBox>
                      : audit.isError ? <StateBox>Erro: {(audit.error as any)?.message}</StateBox>
                      : !audit.data?.length ? <StateBox>Nenhuma ação registrada.</StateBox>
                      : (
                        <div className="divide-y divide-border/60">
                          {audit.data.map((a: any) => (
                            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                              <span><b>{nameOf(a.executor, "Sistema")}</b> · {a.action}{a.target ? ` → ${nameOf(a.target)}` : ""}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{fmt(a.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
