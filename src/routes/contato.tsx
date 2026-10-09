import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { siteUrl } from "@/lib/site-url";

function ContatoPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-neon">{t("contact.kicker")}</div>
        <h1 className="mt-1 text-3xl font-bold">{t("contact.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("contact.lead")}</p>

        <div className="mt-8 terminal-card scanlines relative p-6">
          <div className="flex items-center gap-3">
            <Mail className="h-8 w-8 text-cyan" />
            <div>
              <div className="font-semibold">{t("contact.email.title")}</div>
              <a href="mailto:suportekremlin@gmail.com" className="font-mono text-neon hover:underline">suportekremlin@gmail.com</a>
            </div>
          </div>
        </div>

        <div className="mt-4 terminal-card scanlines relative p-6">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-violet" />
            <div>
              <div className="font-semibold">{t("contact.chat.title")}</div>
              <div className="text-sm text-muted-foreground">{t("contact.chat.desc")}</div>
            </div>
          </div>
          <a href="/dashboard"><Button className="mt-4 font-mono uppercase">{t("contact.chat.cta")}</Button></a>
        </div>
        <section aria-labelledby="help-faq-title" className="mt-10">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-neon">Central de ajuda</p>
          <h2 id="help-faq-title" className="mt-2 text-2xl font-bold">Dúvidas frequentes</h2>
          <p className="mt-2 text-sm text-muted-foreground">Respostas rápidas sobre pagamentos, licenças e atendimento.</p>
          <div className="mt-5 space-y-3">
            <details className="group rounded-xl border border-border/60 bg-card/50 p-4">
              <summary className="cursor-pointer list-none font-semibold">Meu pagamento está pendente. O que faço?<span className="float-right text-primary">＋</span></summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Confira o status do pedido antes de tentar pagar novamente. Se continuar pendente, fale com o suporte e informe o identificador do pedido. Nunca envie senha ou dados completos do cartão.</p>
            </details>
            <details className="group rounded-xl border border-border/60 bg-card/50 p-4">
              <summary className="cursor-pointer list-none font-semibold">O pagamento foi aprovado, mas meu acesso não apareceu.<span className="float-right text-primary">＋</span></summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Entre no painel com a mesma conta usada na compra e confira suas licenças. Se o acesso não aparecer, envie ao suporte o identificador do pedido e um comprovante com dados sensíveis ocultos.</p>
            </details>
            <details className="group rounded-xl border border-border/60 bg-card/50 p-4">
              <summary className="cursor-pointer list-none font-semibold">Como acompanho minha licença ou renovação?<span className="float-right text-primary">＋</span></summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Consulte o painel da sua conta. Se encontrar alguma informação incorreta, entre em contato com o suporte e descreva o problema junto do identificador da compra.</p>
            </details>
            <details className="group rounded-xl border border-border/60 bg-card/50 p-4">
              <summary className="cursor-pointer list-none font-semibold">Que informações devo enviar ao suporte?<span className="float-right text-primary">＋</span></summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Explique o que aconteceu, em qual página e informe o identificador do pedido. Não compartilhe senhas, códigos de autenticação ou tokens de sessão.</p>
            </details>
          </div>
        </section>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Shadow" },
      { name: "description", content: "Fale com o suporte Shadow: e-mail, chat no dashboard e atendimento para dúvidas sobre licenças, servidor e pagamento." },
      { property: "og:title", content: "Contato — Shadow" },
      { property: "og:description", content: "Canais de atendimento oficial do Shadow: suporte por e-mail e chat." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/contato") },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/contato") }],
  }),
  component: ContatoPage,
});
