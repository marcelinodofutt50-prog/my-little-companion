import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pagamento/erro")({
  head: () => ({ meta: [{ title: "Erro no pagamento — Shadow" }] }),
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="terminal-card scanlines relative p-10">
          <XCircle className="mx-auto h-12 w-12 text-danger" />
          <h1 className="mt-4 font-mono text-xl">Pagamento não concluído</h1>
          <p className="mt-2 text-sm text-muted-foreground">Nenhum valor foi cobrado. Tente novamente.</p>
          <Link to="/planos"><Button className="mt-6 font-mono uppercase">Voltar aos planos</Button></Link>
        </div>
      </main>
    </div>
  ),
});
