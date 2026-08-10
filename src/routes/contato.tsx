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
