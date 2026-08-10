import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Award, History, Settings, UserPlus, ClipboardList, CheckCircle2, XCircle, Clock } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SiteHeader } from "@/components/SiteHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { staffListApplications } from "@/lib/staff-admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute('/_authenticated/admin/staff')({
  component: AdminStaffPage,
});

function AdminStaffPage() {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['staff-applications'],
    queryFn: () => staffListApplications()
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-black">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <SiteHeader />
          <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
              <h1 className="text-4xl font-bold tracking-tight text-foreground uppercase italic">Gerenciamento de Equipe</h1>
              <p className="text-muted-foreground mt-2">Controle de hierarquia, permissões e candidaturas.</p>
            </div>

            <Tabs defaultValue="members" className="space-y-6">
              <TabsList className="bg-black/40 border border-white/10">
                <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" /> Membros</TabsTrigger>
                <TabsTrigger value="applications" className="gap-2"><ClipboardList className="h-4 w-4" /> Candidaturas</TabsTrigger>
                <TabsTrigger value="roles" className="gap-2"><Shield className="h-4 w-4" /> Cargos & Permissões</TabsTrigger>
                <TabsTrigger value="audit" className="gap-2"><History className="h-4 w-4" /> Auditoria</TabsTrigger>
              </TabsList>

              <TabsContent value="members">
                <Card className="bg-black/40 border-primary/10">
                  <CardHeader><CardTitle>Equipe Shadow</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-muted-foreground font-mono uppercase text-xs">
                      Lista de membros da staff será carregada aqui.
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="applications">
                <Card className="bg-black/40 border-primary/10">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Recrutamento
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {applications?.length || 0} PENDENTES
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-12 text-muted-foreground animate-pulse font-mono uppercase text-[10px]">
                        Consultando banco de talentos...
                      </div>
                    ) : applications?.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground font-mono uppercase text-[10px]">
                        Nenhuma candidatura pendente no momento.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {applications?.map((app: any) => (
                          <div 
                            key={app.id} 
                            className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">
                                  {app.profile?.full_name || app.profile?.display_name || 'Usuário Sem Nome'}
                                </span>
                                <Badge variant="secondary" className="text-[9px] uppercase">
                                  {app.role_applied || 'Moderador'}
                                </Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {app.profile?.email} • Inscrito em {format(new Date(app.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-2 italic">
                                "{app.reason || 'Sem motivação informada'}"
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button size="sm" variant="outline" className="h-8 text-[10px] border-destructive/20 text-destructive hover:bg-destructive/10">
                                <XCircle className="h-3.5 w-3.5 mr-1.5" /> REJEITAR
                              </Button>
                              <Button size="sm" variant="default" className="h-8 text-[10px] bg-primary text-black hover:bg-primary/90">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> APROVAR
                              </Button>
                            </div>
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
