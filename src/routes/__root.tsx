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
import { PaymentSuccessOverlay } from "@/components/PaymentSuccessOverlay";


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
    
    // Auto-fix for ChunkLoadErrors / Failed to fetch module
    const msg = error.message?.toLowerCase() || "";
    if (msg.includes('failed to fetch dynamically imported module') || 
        msg.includes('chunkloaderror')) {
      console.warn("Detected chunk load error in boundary, performing auto-refresh...");
      // Forçamos o reload se for erro de chunk
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
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
              // Se o reset do router não bastar, um reload com 'true' tenta forçar o bypass do cache
              window.location.reload();
            }}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-all font-mono uppercase tracking-widest"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => {
              // Limpa caches e força reload completo
              if ('caches' in window) {
                caches.keys().then(names => {
                  for (let name of names) caches.delete(name);
                });
              }
              window.location.href = '/?clear_cache=true';
            }}
            className="w-full rounded-md border border-border py-2.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
          >
            Limpar Cache & Reiniciar
          </button>
          <a 
            href="/" 
            className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
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
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
      { rel: "dns-prefetch", href: "https://fonts.gstatic.com" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;800&family=Manrope:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" },
      { rel: "dns-prefetch", href: "https://www.transparenttextures.com" },
      { rel: "preconnect", href: "https://www.transparenttextures.com", crossOrigin: "anonymous" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Shadow",
          url: "https://www.shadowdashstore.com",
          logo: "https://www.shadowdashstore.com/icon-512.png",
          sameAs: [
            "https://www.shadowdashstore.com",
          ],
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            url: "https://www.shadowdashstore.com/contato",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Shadow",
          url: "https://www.shadowdashstore.com",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://www.shadowdashstore.com/planos?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
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
            __html: `(function(){try{var m=localStorage.getItem('shadow-theme')||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var l=(m==='light')||(m==='system'&&!d);var r=document.documentElement;r.classList.toggle('theme-light',l);r.classList.toggle('dark',!l);r.style.colorScheme=l?'light':'dark';var tc=l?'#f9f7f2':'#0a0a0b';var mm=document.querySelector('meta[name="theme-color"]');if(mm)mm.setAttribute('content',tc);}catch(e){}})();`,
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
    // 1. Redireciona de localhost se necessário
    const canonicalUrl = redirectLocalhostAuthToCanonical();
    if (canonicalUrl) {
      window.location.replace(canonicalUrl);
      return;
    }

    // 2. Captura erros de carregamento de chunk (Vite / TanStack Start)
    const handleChunkError = (e: ErrorEvent | PromiseRejectionEvent) => {
      const message = 'reason' in e ? (e.reason?.message || '') : e.message;
      const msgLower = (typeof message === 'string' ? message : '').toLowerCase();
      
      if (msgLower.includes('failed to fetch dynamically imported module') || 
          msgLower.includes('error loading dynamically imported module') ||
          msgLower.includes('failed to fetch') ||
          msgLower.includes('chunkloaderror')) {
        console.warn('Chunk loading or module fetch failed. Force refreshing page...');
        window.location.reload();
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);
    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
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
          <PaymentSuccessOverlay />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}


function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} richColors position="top-right" />;
}


