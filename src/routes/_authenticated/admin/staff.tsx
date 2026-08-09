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
                  <CardHeader><CardTitle>Recrutamento</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-muted-foreground font-mono uppercase text-xs">
                      Novas candidaturas para análise.
                    </div>
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
