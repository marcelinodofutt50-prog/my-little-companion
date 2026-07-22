import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contato")({
  head: () => ({ meta: [{ title: "Contato — Shadow" }, { name: "description", content: "Fale com o suporte Shadow." }] }),
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-neon">// contact</div>
        <h1 className="mt-1 text-3xl font-bold">Fale conosco</h1>
        <p className="mt-2 text-muted-foreground">Já é cliente? Use o chat com admin dentro do painel — resposta muito mais rápida.</p>

        <div className="mt-8 terminal-card scanlines relative p-6">
          <div className="flex items-center gap-3">
            <Mail className="h-8 w-8 text-cyan" />
            <div>
              <div className="font-semibold">E-mail oficial</div>
              <a href="mailto:suportekremlin@gmail.com" className="font-mono text-neon hover:underline">suportekremlin@gmail.com</a>
            </div>
          </div>
        </div>

        <div className="mt-4 terminal-card scanlines relative p-6">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-violet" />
            <div>
              <div className="font-semibold">Chat com Admin</div>
              <div className="text-sm text-muted-foreground">Disponível dentro do painel após login.</div>
            </div>
          </div>
          <a href="/dashboard"><Button className="mt-4 font-mono uppercase">Acessar painel</Button></a>
        </div>
      </main>
    </div>
  ),
});
