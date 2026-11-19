import { Link, useRouterState } from "@tanstack/react-router";
import { Clapperboard, LayoutDashboard,
  Gift, Sparkles, LifeBuoy, ShieldAlert, Download, Users, LogOut, ShieldCheck, Store, Server, Video, Skull, Trophy, User, Lightbulb, Crown, Bitcoin, MessagesSquare } from "lucide-react";

import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { SocialLinks } from "@/components/SocialLinks";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
const shadowMark = "/assets/shadow-logo-compact.png";
import { secureSignOut } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { fetchMyRole, isStaffRole } from "@/lib/roles";

type Item = {
  title: string;
  url: string;
  icon: LucideIcon;
  hash?: string;
  tKey?: Parameters<ReturnType<typeof useI18n>["t"]>[0];
};

const navigation: { label: { pt: string; en: string }; items: Item[] }[] = [
  {
    label: { pt: "Conta e acesso", en: "Account and access" },
    items: [
      { title: "Enterprise Console", url: "/dashboard", icon: LayoutDashboard, tKey: "nav.panel" as const },
      { title: "Shadow Pass", url: "/shadow-pass", icon: User, tKey: "nav.shadowpass" as const },
      { title: "Downloads", url: "/dashboard", hash: "downloads", icon: Download, tKey: "nav.downloads" },
      { title: "Service Agreements", url: "/planos", icon: Sparkles, tKey: "nav.plans" as const },
      { title: "Pagar com Cripto", url: "/crypto", icon: Bitcoin },
    ],
  },
  {
    label: { pt: "Suporte e treinamento", en: "Support and training" },
    items: [
      { title: "Executive Support", url: "/suporte", icon: LifeBuoy, tKey: "nav.support" as const },
      { title: "Training Hub", url: "/tutoriais", icon: Video, tKey: "nav.tutorials" as const },
      { title: "Service Recovery", url: "/servidor/status", icon: Server },
      { title: "Sugestões", url: "/sugestoes", icon: Lightbulb, tKey: "nav.feedback" as const },
    ],
  },
  {
    label: { pt: "Comunidade", en: "Community" },
    items: [
      { title: "Chat dos Clientes", url: "/clientes-chat", icon: MessagesSquare },
      { title: "Shadow Loyalty", url: "/fidelidade", icon: Trophy, tKey: "nav.loyalty" as const },
      { title: "Affiliates", url: "/indicacoes", icon: Users, tKey: "nav.referrals" as const },
      { title: "Gift Center", url: "/presentes", icon: Gift, tKey: "nav.gifts" as const },
      { title: "Área do Parceiro", url: "/parceiro", icon: Crown },
      { title: "Creator", url: "/creator", icon: Clapperboard },
    ],
  },
  {
    label: { pt: "Ferramentas e mercado", en: "Tools and marketplace" },
    items: [
      { title: "Marketplace", url: "/mercado", icon: Store, tKey: "nav.market" as const },
      { title: "Kraken (2.0)", url: "/servidor/kraken", icon: Skull, tKey: "nav.kraken" as const },
      { title: "Asset Provisioning", url: "/play-protect", icon: ShieldCheck, tKey: "nav.playprotect" as const },
    ],
  },
];

export function AppSidebar({ isAdmin }: { isAdmin?: boolean }) {
  const { lang, t } = useI18n();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const { pathname, hash } = useRouterState({ select: (routerState) => routerState.location });
  const currentHash = hash.replace(/^#/, "");
  const isActive = (path: string, targetHash?: string) =>
    pathname === path && (targetHash ? currentHash === targetHash : path !== "/dashboard" || currentHash !== "downloads");

  const closeMobileMenu = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isMobile && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      setOpenMobile(false);
    }
  };
  const [resolvedStaff, setResolvedStaff] = useState(isAdmin ?? false);

  useEffect(() => {
    if (typeof isAdmin === "boolean") {
      setResolvedStaff(isAdmin);
      return;
    }
    let active = true;
    fetchMyRole().then((role) => {
      if (active) setResolvedStaff(isStaffRole(role));
    }).catch(() => {});
    return () => { active = false; };
  }, [isAdmin]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 py-3">
        <Link to="/dashboard" onClick={closeMobileMenu} className="flex items-center gap-2.5 px-1">
          <div className="relative grid h-9 w-9 shrink-0 place-items-center">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[var(--neon)] opacity-25 blur-lg" />
            <img src={shadowMark} alt="Shadow" width={32} height={32} decoding="async" className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(201,168,76,0.55)]" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-semibold tracking-tight">SHADOW</div>
              <div className="truncate font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">enterprise console</div>
            </div>
          )}
        </Link>
        {!collapsed && <SocialLinks className="mt-2 px-1 pl-[2.9rem]" />}
      </SidebarHeader>

      <SidebarContent className="gap-0 py-1">
        {navigation.map(({ label, items }) => (
          <SidebarGroup key={label.en} className="border-b border-sidebar-border/60 py-2 last:border-b-0">
            {!collapsed && (
              <SidebarGroupLabel className="h-6 text-xs font-semibold text-sidebar-foreground/75">
                {label[lang]}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {items.map((item) => {
                  const label = item.tKey ? t(item.tKey) : item.title;
                  const active = isActive(item.url, item.hash);
                  return (
                    <SidebarMenuItem key={item.hash ?? item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                        className="h-8 gap-2.5 data-[active=true]:bg-sidebar-primary/12 data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary"
                      >
                        <Link
                          to={item.url}
                          hash={item.hash}
                          activeOptions={{ exact: true, includeHash: true }}
                          aria-current={active ? (item.hash ? "location" : "page") : undefined}
                          aria-label={label}
                          onClick={closeMobileMenu}
                        >
                          <item.icon aria-hidden="true" />
                          {!collapsed && <span>{label}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {resolvedStaff && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">{t("nav.admin") as string}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip={t("nav.admin") as string}>
                    <Link to="/admin" onClick={closeMobileMenu} aria-label={t("nav.admin")} className="flex items-center gap-2.5">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      {!collapsed && <span className="text-sm">{t("nav.admin") as string}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { void secureSignOut(); }} tooltip={t("nav.signout") as string}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="text-sm">{t("nav.signout") as string}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
