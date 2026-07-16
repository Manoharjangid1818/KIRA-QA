import { ReactNode } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarProvider, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, Building2, FolderKanban, BookOpen,
  FileText, ShieldCheck, Settings2, MessageSquareDot, BarChart3,
  Settings, LogOut, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isAdminRole } from "@/lib/types";

interface AdminLayoutProps { children: ReactNode; }

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/knowledge-bases", label: "Knowledge Bases", icon: BookOpen },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/access-control", label: "Access Control", icon: ShieldCheck },
  { href: "/admin/ai-configuration", label: "AI Configuration", icon: Bot },
  { href: "/admin/prompts", label: "Prompt Management", icon: MessageSquareDot },
  { href: "/admin/usage-logs", label: "Usage & Logs", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoading, logout } = useAuth();
  const [location] = useLocation();

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading…</div>
  );
  if (!user) return <Redirect to="/login" />;
  if (!isAdminRole(user.role)) return <Redirect to="/chat" />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar className="border-r bg-sidebar" variant="inset">
          <SidebarHeader className="h-16 flex items-center px-4 border-b gap-2">
            <div className="flex items-center gap-2 text-sidebar-primary font-bold text-lg tracking-tight">
              <Bot className="w-6 h-6" />
              <span>KIRA<span className="text-sidebar-foreground font-normal">.AI</span></span>
            </div>
            <Badge variant="secondary" className="text-xs ml-auto">Admin</Badge>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map(({ href, label, icon: Icon }) => {
                    const isActive = href === "/admin" ? location === "/admin" : location.startsWith(href);
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={href}>
                            <Icon className="w-4 h-4" />
                            <span>{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{user.full_name}</span>
                <span className="text-xs text-muted-foreground truncate capitalize">{user.role.replace('_', ' ')}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={logout}>
              <LogOut className="h-4 w-4" />Sign out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-h-0 bg-muted/20 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
