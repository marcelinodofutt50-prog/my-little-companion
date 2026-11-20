import { getBrowserAuthUser } from "@/lib/browser-auth-user";
import { BanNotice } from "@/components/BanNotice";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { CurrencyToggle } from "@/lib/currency";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InAppNotifications } from "@/components/InAppNotifications";
import { SystemHealthIndicator } from "@/components/SystemHealthIndicator";
import { SocialLinks } from "@/components/SocialLinks";
import { KrakenTab } from "@/components/KrakenTab";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyIdentity } from "@/lib/identity.functions";


import type { User } from "@supabase/supabase-js";

export function SiteHeader() {
  const shadowMark = "/assets/shadow-logo-compact.png";
  const { location } = useRouterState();
  const path = location.pathname;
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const { t, lang } = useI18n();

  const identityFn = useServerFn(getMyIdentity);
  const { data: identity } = useQuery({
    queryKey: ["my-identity"],
    queryFn: () => identityFn({}),
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    getBrowserAuthUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const primary = [
    { to: "/planos", label: t("nav.plans") },
    { to: "/vps", label: "VPS" },
    { to: "/tutoriais", label: t("nav.tutorial") },
    { to: "/mercado", label: t("nav.market") },
    
  ] as const;

  const more = [
    { to: "/gangstar-remote", label: "Gangstar Remote 4.5" },
    { to: "/migracao", label: t("nav.migration") },
    { to: "/crypto", label: t("nav.crypto") },
    { to: "/contato", label: t("nav.contact") },
  ] as const;

  const english = lang === "en";
  const preferences = english ? "Preferences" : "Preferências";
  const navigation = english ? "Main navigation" : "Navegação principal";
  const settings = [
    { label: english ? "Appearance" : "Aparência", Control: ThemeToggle },
    { label: english ? "Language" : "Idioma", Control: LanguageToggle },
    { label: english ? "Currency" : "Moeda", Control: CurrencyToggle },
  ];

  const allLinks = [{ to: "/", label: t("nav.home") }, ...primary, ...more];
  const linkCls = (active: boolean) =>
    `inline-flex h-9 items-center whitespace-nowrap rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-2 px-3 sm:gap-4 sm:px-6">
        {/* Brand */}
        <Link to="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-70">
          <img src={shadowMark} alt="" width={32} height={32} decoding="async" className="block h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8 drop-shadow-[0_0_8px_rgba(201,168,76,0.6)] brightness-110 dark:brightness-125 dark:contrast-125 transition-all duration-300" />
          <span className="font-display text-lg leading-none tracking-tight sm:text-xl">Shadow</span>
        </Link>
        <SocialLinks className="hidden border-l border-border/70 pl-3 sm:flex" />

        {/* Desktop nav */}
        <nav aria-label={navigation} className="hidden flex-1 items-center gap-1 xl:flex">
          {primary.map((l) => (
            <Link key={l.to} to={l.to} aria-current={path === l.to ? "page" : undefined} className={linkCls(path === l.to)}>
              {l.label}
            </Link>
          ))}
          <div className="px-2"><KrakenTab /></div>
          <DropdownMenu>
            <DropdownMenuTrigger className={`${linkCls(more.some((l) => l.to === path))} gap-1`}>
              {lang === "en" ? "More" : "Mais"} <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40 rounded-lg">
              {more.map((l) => (
                <DropdownMenuItem key={l.to} asChild>
                  <Link to={l.to}>{l.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden shrink-0 xl:block"><SystemHealthIndicator /></div>
          {user && <InAppNotifications />}

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="icon" variant="ghost" aria-label={preferences} title={preferences} className="shrink-0">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 max-w-[calc(100vw-2rem)] rounded-xl p-0">
              <p className="border-b border-border px-4 py-3 text-sm font-semibold">{preferences}</p>
              <div className="divide-y divide-border px-4">
                {settings.map(({ label, Control }) => (
                  <div key={label} className="flex min-h-12 items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <Control />
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {user ? (
            <div className="flex shrink-0 items-center gap-2 sm:border-l sm:border-border/70 sm:pl-2">
              <Link
                to="/shadow-pass"
                className="hidden items-center gap-2 rounded-md px-1 py-1 hover:bg-muted sm:flex"
                title={identity?.nickname || "Shadow Pass"}
              >
                <Avatar className="h-7 w-7 border border-primary/40">
                  <AvatarImage src={identity?.avatar || undefined} className="object-cover" />
                  <AvatarFallback className="text-[10px] font-mono">
                    {(identity?.nickname || user.email || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-24 truncate text-sm font-medium 2xl:block">
                  {identity?.nickname || user.email?.split("@")[0]}
                </span>
              </Link>
              <Button asChild size="sm" className="rounded-md px-3 font-semibold sm:px-4">
                <Link to="/dashboard">{t("nav.panel")}</Link>
              </Button>
            </div>
          ) : (
            <Button asChild size="sm" variant="outline" className="hidden rounded-md px-4 font-semibold sm:inline-flex">
              <Link to="/auth">{t("nav.signin")}</Link>
            </Button>
          )}

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="xl:hidden" aria-label={navigation}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 overflow-y-auto p-0">
              <SheetTitle className="sr-only">{navigation}</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="hairline-b px-6 py-5">
                  <div className="flex items-center gap-2">
                    <img src={shadowMark} alt="" width={32} height={32} loading="lazy" decoding="async" className="block h-7 w-7 shrink-0 object-contain brightness-110 dark:brightness-125 dark:contrast-125 transition-all duration-300" />
                    <span className="font-display text-xl tracking-tight">Shadow</span>
                  </div>
                </div>
                <nav aria-label={navigation} className="flex flex-col gap-1 p-4">
                  <div className="px-3 py-3 border-b border-muted/50 mb-1 flex justify-center">
                    <KrakenTab onNavigate={() => setOpen(false)} />
                  </div>


                  {user && (
                    <>
                      <Link
                        to="/dashboard"
                        onClick={() => setOpen(false)}
                        className={`rounded-sm px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                          path === "/dashboard"
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {t("nav.panel")}
                      </Link>
                      <Link
                        to="/shadow-pass"
                        onClick={() => setOpen(false)}
                        className={`rounded-sm px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                          path === "/shadow-pass"
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        Shadow Pass
                      </Link>
                    </>
                  )}

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
                  <SystemHealthIndicator />
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
      <BanNotice />
    </header>
  );
}
