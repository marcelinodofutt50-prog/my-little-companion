import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles, LifeBuoy, ShieldAlert, Download, Users, LogOut, ShieldCheck, Store } from "lucide-react";
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

type Item = { title: string; url: string; icon: any; hash?: string };

const primary: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Play Protect", url: "/play-protect", icon: ShieldCheck },
  { title: "Planos", url: "/planos", icon: Sparkles },
  { title: "Mercado", url: "/mercado", icon: Store },
  { title: "Indicações", url: "/indicacoes", icon: Users },
  { title: "Suporte", url: "/suporte", icon: LifeBuoy },
];

export function AppSidebar({ isAdmin }: { isAdmin?: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 py-3">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-1">
          <div className="relative grid h-9 w-9 shrink-0 place-items-center">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[var(--neon)] opacity-25 blur-lg" />
            <img src={shadowMark} alt="Shadow" className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(201,168,76,0.55)]" />
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
          {!collapsed && <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.22em]">Navegação</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Downloads">
                  <a href="/dashboard#downloads" className="flex items-center gap-2.5">
                    <Download className="h-4 w-4" />
                    {!collapsed && <span className="text-sm">Downloads</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">Admin</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip="Painel Admin">
                    <Link to="/admin" className="flex items-center gap-2.5">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      {!collapsed && <span className="text-sm">Painel Admin</span>}
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
            <SidebarMenuButton onClick={() => supabase.auth.signOut()} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="text-sm">Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
