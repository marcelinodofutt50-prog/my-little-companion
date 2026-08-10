import { createFileRoute } from "@tanstack/react-router";
import { Youtube, Download } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { siteUrl } from "@/lib/site-url";

function TutorialPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-neon">{t("tutorial.kicker")}</div>
        <h1 className="mt-1 text-3xl font-bold">{t("tutorial.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("tutorial.lead")}</p>

        <div className="mt-8 terminal-card scanlines relative p-6">
          <div className="flex items-center gap-3">
            <Youtube className="h-8 w-8 text-danger" />
            <div>
              <div className="font-semibold">{t("tutorial.yt.title")}</div>
              <div className="text-sm text-muted-foreground">{t("tutorial.yt.desc")}</div>
            </div>
          </div>
          <a href="https://www.youtube.com/@krebgulin" target="_blank" rel="noreferrer">
            <Button className="mt-4 font-mono uppercase">{t("tutorial.yt.cta")}</Button>
          </a>
        </div>

        <div className="mt-6 terminal-card scanlines relative p-6">
          <div className="flex items-center gap-3">
            <Download className="h-8 w-8 text-neon" />
            <div>
              <div className="font-semibold">{t("tutorial.dl.title")}</div>
              <div className="text-sm text-muted-foreground">
                {t("tutorial.dl.pass")} <span className="font-mono text-neon">@kremlinbrd</span>
              </div>
            </div>
          </div>
          <a href="https://www.mediafire.com/file/qkowv9rdx7a3jeu/bt+atualizada.zip/file" target="_blank" rel="noreferrer">
            <Button variant="outline" className="mt-4 font-mono uppercase">{t("tutorial.dl.cta")}</Button>
          </a>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/tutorial")({
  head: () => ({
    meta: [
      { title: "Tutorial — Shadow" },
      { name: "description", content: "Aprenda a usar o Shadow BTMOB: instalação, configuração, downloads e primeiros passos passo a passo." },
      { property: "og:title", content: "Tutorial — Shadow" },
      { property: "og:description", content: "Guia completo para instalar e usar o Shadow BTMOB." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: siteUrl("/tutorial") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/tutorial") }],
  }),
  component: TutorialPage,
});
