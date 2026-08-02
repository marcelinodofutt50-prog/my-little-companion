import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { redirectLocalhostAuthToCanonical } from "@/lib/site-url";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider, useTheme } from "@/lib/theme";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-7xl font-bold text-neon">404</h1>
        <h2 className="mt-4 font-mono text-xl text-foreground">// signal_lost</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta rota não existe no grid do Shadow.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-xl text-danger">// system_error</h1>
        <p className="mt-2 text-sm text-muted-foreground">Algo falhou no processo. Tente novamente.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >Tentar novamente</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm">Início</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Shadow — Advanced Intelligence & OSINT Infrastructure" },
      { name: "description", content: "Shadow BTMOB: uma plataforma editorial de OSINT e cybersegurança. Licenças instantâneas, pagamento PIX automático, suporte humano 24/7." },
      { name: "theme-color", content: "#f9f7f2" },
      { property: "og:title", content: "Shadow — Advanced Intelligence & OSINT Infrastructure" },
      { property: "og:description", content: "Shadow BTMOB: uma plataforma editorial de OSINT e cybersegurança. Licenças instantâneas via PIX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Shadow — Advanced Intelligence & OSINT Infrastructure" },
      { name: "twitter:description", content: "Shadow BTMOB: uma plataforma editorial de OSINT e cybersegurança." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/4b727f34-aaae-47c7-993e-3c321c416e45" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/4b727f34-aaae-47c7-993e-3c321c416e45" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Fallback: se o usuário abriu um link de confirmação de e-mail que ainda
  // aponta para localhost (Supabase Site URL desatualizado), redireciona para
  // o domínio oficial preservando code/type/next.
  // IMPORTANTE: nunca bloquear a renderização enquanto isso é checado — se o
  // app renderizar `null` até um efeito rodar, qualquer falha de hidratação
  // deixa a página totalmente preta.
  useEffect(() => {
    const canonicalUrl = redirectLocalhostAuthToCanonical();
    if (canonicalUrl) window.location.replace(canonicalUrl);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <Outlet />
          <ThemedToaster />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} richColors position="top-right" />;
}


