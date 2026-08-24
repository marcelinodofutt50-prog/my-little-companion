import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { siteUrl } from "@/lib/site-url";


export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Shadow" },
      { name: "description", content: "Termos de uso da Shadow: licenças, entrega automática, garantia de 7 dias, renovação mensal e regras de suporte." },
      { property: "og:title", content: "Termos de Uso — Shadow" },
      { property: "og:description", content: "Regras de licenciamento, entrega, reembolso e suporte da Shadow." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/termos") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/termos") }],

  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground">Última atualização: julho de 2026.</p>
        </header>

        <Section title="1. Objeto">
          <p>Estes termos regulam a contratação de licenças de acesso e serviços associados oferecidos neste site. Ao concluir um pagamento, você declara ter lido e aceitado estas condições.</p>
        </Section>

        <Section title="2. Licenças e entrega">
          <p>As licenças são pessoais e intransferíveis. Após a confirmação do pagamento pelo provedor oficial de pagamentos, a licença é criada automaticamente e as credenciais ficam disponíveis no painel do cliente, normalmente em menos de um minuto.</p>
          <p>É proibido revender, compartilhar ou redistribuir credenciais sem autorização expressa. O descumprimento pode gerar revogação imediata sem reembolso.</p>
        </Section>

        <Section title="3. Renovação e vencimento">
          <p>Planos mensais seguem o ciclo de cobrança do dia 20. O painel exibe avisos de vencimento com antecedência. Licenças não renovadas podem ser suspensas até a regularização.</p>
        </Section>

        <Section title="4. Reembolso">
          <p>O pedido de reembolso pode ser feito em até 7 dias corridos após a compra, diretamente pelo painel. A análise ocorre em até 2 dias úteis. Reembolsos podem ser negados em caso de uso abusivo, violação destes termos ou indícios de fraude.</p>
        </Section>

        <Section title="5. Uso aceitável">
          <p>O serviço deve ser utilizado apenas para finalidades lícitas e autorizadas. O cliente é o único responsável pelo uso que fizer das ferramentas e pelas consequências legais desse uso.</p>
        </Section>

        <Section title="6. Suporte">
          <p>O suporte é prestado pelo chat do painel. Prazos de resposta podem variar conforme volume de atendimento.</p>
        </Section>

        <Section title="7. Limitação de responsabilidade">
          <p>O serviço é fornecido no estado em que se encontra. Não nos responsabilizamos por indisponibilidades de terceiros, uso indevido da ferramenta ou perdas indiretas.</p>
        </Section>

        <Section title="8. Contato">
          <p>Dúvidas sobre estes termos podem ser enviadas pela <Link to="/contato" className="text-primary underline">página de contato</Link>.</p>
        </Section>

        <p className="text-xs text-muted-foreground">
          Veja também a <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
        </p>
      </main>
    </div>
  );
}
