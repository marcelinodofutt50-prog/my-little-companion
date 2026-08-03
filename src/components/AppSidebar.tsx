import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard,
  Gift, Sparkles, LifeBuoy, ShieldAlert, Download, Users, LogOut, ShieldCheck, Store, Server } from "lucide-react";
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
import shadowMark from "@/assets/shadow-mask.png";
import { secureSignOut } from "@/lib/session";
import { useI18n } from "@/lib/i18n";

type Item = { title: string; url: string; icon: any; hash?: string; tKey?: any };

const primary: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, tKey: "nav.panel" as const },
  { title: "Shadow Signer", url: "/play-protect", icon: ShieldCheck, tKey: "nav.playprotect" as const },
  { title: "Planos", url: "/planos", icon: Sparkles, tKey: "nav.plans" as const },
  { title: "Mercado", url: "/mercado", icon: Store, tKey: "nav.market" as const },
  { title: "Indicações", url: "/indicacoes", icon: Users, tKey: "nav.referrals" as const },
  { title: "Presentes", url: "/presentes", icon: Gift, tKey: "nav.gifts" as const },
  { title: "Suporte", url: "/suporte", icon: LifeBuoy, tKey: "nav.support" as const },
  { title: "Status", url: "/servidor/status", icon: Server },
];


export function AppSidebar({ isAdmin }: { isAdmin?: boolean }) {
  const { t } = useI18n();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { location } = useRouterState();
  const currentPath = location.pathname;
  const search = location.search as any;
  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 py-3">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-1">
          <div className="relative grid h-9 w-9 shrink-0 place-items-center">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[var(--neon)] opacity-25 blur-lg" />
            <img src={shadowMark} alt="Shadow" width={32} height={32} decoding="async" className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(201,168,76,0.55)]" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-semibold tracking-tight">SHADOW</div>
              <div className="truncate font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">operator console</div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.22em]">{t("nav.navigation") as string}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.tKey ? t(item.tKey) : item.title}>
                    <Link to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="text-sm">{item.tKey ? t(item.tKey) : item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={t("nav.downloads") as string}>
                  <Link to="/dashboard" hash="downloads" className="flex items-center gap-2.5">
                    <Download className="h-4 w-4" />
                    {!collapsed && <span className="text-sm">{t("nav.downloads") as string}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">{t("nav.admin") as string}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip={t("nav.admin") as string}>
                    <Link to="/admin" className="flex items-center gap-2.5">
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
