import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BackToDashboard } from "@/components/BackToDashboard";

// Área desativada. O antigo fluxo (builder de APK / "bypass" de Play Protect)
// foi removido: produzia APKs disfarçados que evadem a detecção de apps nocivos
// do Android, o que foge do escopo legítimo do painel. A rota permanece só para
// não quebrar links antigos e exibe um aviso neutro.
export const Route = createFileRoute("/_authenticated/play-protect")({
  head: () => ({
    meta: [
      { title: "Serviço indisponível — Shadow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlayProtectUnavailable,
});

function PlayProtectUnavailable() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0 flex-1">
          <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
            <div className="mb-6">
              <BackToDashboard />
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background/40">
                <ShieldAlert className="h-6 w-6 text-muted-foreground" />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Serviço indisponível</h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Esta área foi desativada e não está mais disponível. Se você precisa de
                ajuda com a sua licença ou com o painel, fale com a equipe pelo suporte.
              </p>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
