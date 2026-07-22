import { createFileRoute } from "@tanstack/react-router";
import { Youtube, Download } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tutorial")({
  head: () => ({ meta: [{ title: "Tutorial — Shadow" }, { name: "description", content: "Aprenda a usar o Shadow BTMOB." }] }),
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-neon">// docs</div>
        <h1 className="mt-1 text-3xl font-bold">Tutoriais Shadow</h1>
        <p className="mt-2 text-muted-foreground">Vídeos oficiais de como configurar e operar o BTMOB.</p>

        <div className="mt-8 terminal-card scanlines relative p-6">
          <div className="flex items-center gap-3">
            <Youtube className="h-8 w-8 text-danger" />
            <div>
              <div className="font-semibold">Canal oficial no YouTube</div>
              <div className="text-sm text-muted-foreground">@krebgulin — tutoriais completos</div>
            </div>
          </div>
          <a href="https://www.youtube.com/@krebgulin" target="_blank" rel="noreferrer">
            <Button className="mt-4 font-mono uppercase">Assistir tutoriais</Button>
          </a>
        </div>

        <div className="mt-6 terminal-card scanlines relative p-6">
          <div className="flex items-center gap-3">
            <Download className="h-8 w-8 text-neon" />
            <div>
              <div className="font-semibold">Baixar BTMOB</div>
              <div className="text-sm text-muted-foreground">Senha do arquivo: <span className="font-mono text-neon">@kremlinbrd</span></div>
            </div>
          </div>
          <a href="https://www.mediafire.com/file/qkowv9rdx7a3jeu/bt+atualizada.zip/file" target="_blank" rel="noreferrer">
            <Button variant="outline" className="mt-4 font-mono uppercase">Download Mediafire</Button>
          </a>
        </div>
      </main>
    </div>
  ),
});
