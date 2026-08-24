import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { siteUrl } from "@/lib/site-url";


export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Shadow" },
      { name: "description", content: "Como a Shadow coleta, usa e protege seus dados: conta, pagamentos, suporte, cookies e seus direitos como titular." },
      { property: "og:title", content: "Política de Privacidade — Shadow" },
      { property: "og:description", content: "Dados coletados, finalidade, retenção e direitos do titular." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/privacidade") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/privacidade") }],

  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Última atualização: julho de 2026.</p>
        </header>

        <Section title="1. Dados que coletamos">
          <p>Coletamos os dados necessários para criar sua conta e entregar o serviço: e-mail, nome informado no cadastro, histórico de pedidos e licenças, mensagens de suporte e registros técnicos de acesso.</p>
        </Section>

        <Section title="2. Pagamentos">
          <p>Os pagamentos são processados pelo provedor oficial de pagamentos. Não armazenamos dados de cartão. Recebemos apenas o status e os identificadores da transação para liberar sua licença.</p>
        </Section>

        <Section title="3. Finalidade do uso">
          <p>Usamos seus dados para autenticação, entrega e renovação de licenças, atendimento de suporte, prevenção a fraudes e cumprimento de obrigações legais.</p>
        </Section>

        <Section title="4. Compartilhamento">
          <p>Não vendemos dados pessoais. Compartilhamos apenas com prestadores essenciais à operação — hospedagem, banco de dados, gateway de pagamento e envio de e-mails — limitados ao necessário.</p>
        </Section>

        <Section title="5. Segurança">
          <p>Credenciais sensíveis são armazenadas criptografadas e o acesso ao painel é protegido por autenticação. O acesso aos dados é restrito por regras de permissão no banco.</p>
        </Section>

        <Section title="6. Retenção">
          <p>Mantemos os dados enquanto sua conta existir e pelo prazo exigido por lei para registros fiscais e de segurança. Depois disso, os dados são excluídos ou anonimizados.</p>
        </Section>

        <Section title="7. Cookies">
          <p>Usamos apenas cookies e armazenamento local essenciais para manter a sessão e preferências (como tema e avisos dispensados).</p>
        </Section>

        <Section title="8. Seus direitos">
          <p>Você pode solicitar acesso, correção, exportação ou exclusão dos seus dados pela <Link to="/contato" className="text-primary underline">página de contato</Link> ou pelo chat de suporte.</p>
        </Section>

        <p className="text-xs text-muted-foreground">
          Veja também os <Link to="/termos" className="text-primary underline">Termos de Uso</Link>.
        </p>
      </main>
    </div>
  );
}
