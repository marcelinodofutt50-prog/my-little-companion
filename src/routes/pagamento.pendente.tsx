import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pagamento/pendente")({
  head: () => ({ meta: [{ title: "Pagamento pendente — Shadow" }] }),
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="terminal-card scanlines relative p-10">
          <Clock className="mx-auto h-12 w-12 text-cyan" />
          <h1 className="mt-4 font-mono text-xl">Pagamento pendente</h1>
          <p className="mt-2 text-sm text-muted-foreground">Assim que o PIX for compensado, sua licença será liberada automaticamente.</p>
          <Link to="/dashboard"><Button className="mt-6 font-mono uppercase">Ir para o painel</Button></Link>
        </div>
      </main>
    </div>
  ),
});
