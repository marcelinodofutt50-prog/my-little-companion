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
  console.error("Root Error Boundary caught:", error);
  const router = useRouter();
  
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="enterprise-surface max-w-md p-8 shadow-2xl text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <span className="font-mono text-xl font-bold">!</span>
        </div>
        <h1 className="font-mono text-xl text-danger uppercase tracking-[0.3em]">// system_error</h1>
        <p className="mt-4 text-sm text-muted-foreground">Algo falhou no processo. Tente novamente.</p>
        
        {/* Mostra detalhes do erro apenas em desenvolvimento ou se for um erro conhecido */}
        <div className="mt-4 p-3 bg-black/40 text-[10px] text-left font-mono overflow-auto max-h-40 rounded border border-danger/20 text-muted-foreground/80">
          <div className="text-danger/60 mb-1 uppercase tracking-tighter">Stack Trace / Details:</div>
          {error.message || "Unknown error occurred"}
          {error.stack && (
            <div className="mt-2 opacity-50 whitespace-pre-wrap">
              {error.stack.split('\n').slice(0, 3).join('\n')}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => { 
              router.invalidate(); 
              reset(); 
              // Se o reset do router não bastar, um reload limpa o estado global do React
              window.location.reload();
            }}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-all font-mono uppercase tracking-widest"
          >
            Tentar novamente
          </button>
          <a 
            href="/" 
            className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            Voltar ao Início
          </a>
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
    // O script inline abaixo aplica tema/color-scheme no <html> antes da
    // hidratação; sem isto o React reclama de mismatch e descarta a classe.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Aplica o tema (sistema/claro/escuro) antes da primeira pintura */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('shadow-theme')||'system';var l=(m==='light')||(m==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches);var r=document.documentElement;r.classList.toggle('theme-light',l);r.classList.toggle('dark',!l);r.style.colorScheme=l?'light':'dark';}catch(e){}})();`,
          }}
        />
      </head>
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


