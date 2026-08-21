import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InAppNotifications } from "@/components/InAppNotifications";
import { SystemHealthIndicator } from "@/components/SystemHealthIndicator";
import { KrakenTab } from "@/components/KrakenTab";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyIdentity } from "@/lib/identity.functions";


import type { User } from "@supabase/supabase-js";

export function SiteHeader() {
  const shadowMark = "/assets/shadow-logo-v10.png?v=v10-100";
  const { location } = useRouterState();
  const path = location.pathname;
  const search = location.search as any;
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const identityFn = useServerFn(getMyIdentity);
  const { data: identity } = useQuery({
    queryKey: ["my-identity"],
    queryFn: () => identityFn({}),
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const primary = [
    { to: "/planos", label: t("nav.plans") },
    { to: "/tutoriais", label: t("nav.tutorial") },
    { to: "/mercado", label: t("nav.market") },
    
  ] as const;

  const more = [
    { to: "/migracao", label: "Migração" },
    { to: "/crypto", label: t("nav.crypto") },
    { to: "/contato", label: t("nav.contact") },
  ] as const;

  const allLinks = [{ to: "/", label: t("nav.home") }, ...primary, ...more];
  const linkCls = (active: boolean) =>
    `font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-50 hairline-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
        {/* Brand */}
        <Link to="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-70">
          <img src={shadowMark} alt="" width={32} height={32} decoding="async" className="block h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8 drop-shadow-[0_0_8px_rgba(201,168,76,0.6)] brightness-110 dark:brightness-125 dark:contrast-125 transition-all duration-300" />
          <span className="font-display text-lg leading-none tracking-tight sm:text-xl">Shadow</span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-6 hidden flex-1 items-center gap-7 lg:flex">
          {primary.map((l) => (
            <Link key={l.to} to={l.to} className={linkCls(path === l.to)}>
              {l.label}
            </Link>
          ))}
          <KrakenTab />
          <DropdownMenu>
            <DropdownMenuTrigger className={`${linkCls(more.some((l) => l.to === path))} inline-flex items-center gap-1 outline-none`}>
              Mais <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-none font-mono text-[11px] uppercase tracking-[0.2em]">
              {more.map((l) => (
                <DropdownMenuItem key={l.to} asChild>
                  <Link to={l.to}>{l.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-3">
          <div className="hidden lg:block"><SystemHealthIndicator /></div>
          {user && <InAppNotifications />}

          <ThemeToggle />
          <span className="hidden sm:inline-flex"><LanguageToggle /></span>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/shadow-pass"
                className="hidden items-center gap-2 sm:flex"
                title={identity?.nickname || "Shadow Pass"}
              >
                <Avatar className="h-7 w-7 border border-primary/40">
                  <AvatarImage src={identity?.avatar || undefined} className="object-cover" />
                  <AvatarFallback className="text-[10px] font-mono">
                    {(identity?.nickname || user.email || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[120px] truncate font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {identity?.nickname || user.email?.split("@")[0]}
                </span>
              </Link>
              <Link to="/dashboard">
                <Button size="sm" className="rounded-none px-2.5 font-mono text-[10px] uppercase tracking-[0.2em] sm:px-3">
                  {t("nav.panel")}
                </Button>
              </Link>
            </div>
          ) : (
            <Link to="/auth" className="hidden sm:block">
              <Button
                size="sm"
                variant="outline"
                className="rounded-none border-foreground font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
              >
                {t("nav.signin")}
              </Button>
            </Link>
          )}

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex h-full flex-col">
                <div className="hairline-b px-6 py-5">
                  <div className="flex items-center gap-2">
                    <img src={shadowMark} alt="" width={32} height={32} loading="lazy" decoding="async" className="block h-7 w-7 shrink-0 object-contain brightness-110 dark:brightness-125 dark:contrast-125 transition-all duration-300" />
                    <span className="font-display text-xl tracking-tight">Shadow</span>
                  </div>
                </div>
                <nav className="flex flex-col gap-1 p-4">
                  <div className="px-3 py-3 border-b border-muted/50 mb-1 flex justify-center">
                    <KrakenTab onNavigate={() => setOpen(false)} />
                  </div>


                  {allLinks.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className={`rounded-sm px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                        path === l.to
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-auto space-y-3 px-4 pb-6">
                  <div className="flex items-center gap-2">
                    <LanguageToggle />
                    <ThemeToggle />
                  </div>
                  {!user && (
                    <Link to="/auth" onClick={() => setOpen(false)} className="block">
                      <Button variant="outline" className="w-full rounded-none border-foreground font-mono text-[10px] uppercase tracking-[0.2em]">
                        {t("nav.signin")}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
