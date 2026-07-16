import { ReactNode, useState } from "react";
import { Link, Redirect, useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { isAdminRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquarePlus, Search, Bot, LogOut, User, Files,
  MoreHorizontal, Trash2, PencilLine, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserLayoutProps { children: ReactNode; }

type SidebarView = "chats" | "files" | "profile";

export function UserLayout({ children }: UserLayoutProps) {
  const { user, isLoading, logout } = useAuth();
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<SidebarView>("chats");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiFetch<Conversation[]>("/conversations"),
    enabled: !!user,
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate("/chat");
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      apiFetch(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setRenamingId(null);
    },
  });

  const attachmentsQuery = useQuery({
    queryKey: ["my-files"],
    queryFn: () => apiFetch<any[]>("/attachments"),
    enabled: !!user && view === "files",
  });

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading…</div>
  );
  if (!user) return <Redirect to="/login" />;
  if (isAdminRole(user.role)) return <Redirect to="/admin" />;

  const conversations = conversationsQuery.data ?? [];
  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const currentId = location.startsWith("/chat/") ? parseInt(location.split("/chat/")[1]) : null;

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r bg-sidebar flex flex-col">
        {/* Header */}
        <div className="h-14 flex items-center px-4 border-b gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-bold text-base tracking-tight">KIRA<span className="font-normal text-muted-foreground">.AI</span></span>
        </div>

        {/* New Chat */}
        <div className="p-3 border-b">
          <Button
            className="w-full gap-2 justify-start"
            size="sm"
            onClick={() => { setView("chats"); navigate("/chat"); }}
          >
            <MessageSquarePlus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Sidebar links (chat-only items) */}
        <div className="flex border-b">
          {(["chats", "files", "profile"] as SidebarView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex-1 py-2 text-xs font-medium capitalize transition-colors",
                view === v ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "chats" ? "Chats" : v === "files" ? "My Files" : "Profile"}
            </button>
          ))}
        </div>


        {/* Content area */}
        {view === "chats" && (
          <>
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search chats…"
                  className="pl-7 h-8 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="flex-1 px-2">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {search ? "No chats found" : "No conversations yet"}
                </p>
              ) : (
                <div className="space-y-0.5 pb-4">
                  {filtered.map(conv => (
                    <div
                      key={conv.id}
                      className={cn(
                        "group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors text-sm",
                        currentId === conv.id
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                      onClick={() => navigate(`/chat/${conv.id}`)}
                    >
                      <span className="flex-1 truncate text-xs">{conv.title}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={e => {
                            e.stopPropagation();
                            setRenamingId(conv.id);
                            setRenameValue(conv.title);
                          }}>
                            <PencilLine className="w-3.5 h-3.5 mr-2" />Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={e => { e.stopPropagation(); deleteMutation.mutate(conv.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {view === "files" && (
          <ScrollArea className="flex-1 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">My uploaded files</p>
            {(attachmentsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No files uploaded yet</p>
            ) : (
              <div className="space-y-1">
                {(attachmentsQuery.data ?? []).map((f: any) => (
                  <div key={f.id} className="flex items-start gap-2 rounded-md p-2 hover:bg-accent/50 text-xs">
                    <Files className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.file_name}</p>
                      <p className="text-muted-foreground">{f.file_type} · {(f.file_size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {view === "profile" && (
          <div className="flex-1 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{user.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Role</span>
                <span className="capitalize font-medium">{user.role.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Status</span>
                <span className={cn("font-medium capitalize", user.status === "active" ? "text-green-600" : "text-red-600")}>{user.status}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
            <LogOut className="w-4 h-4" />Sign out
          </Button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>

      {/* Rename dialog */}
      <Dialog open={renamingId !== null} onOpenChange={open => !open && setRenamingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename conversation</DialogTitle></DialogHeader>
          <Input
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && renamingId !== null) {
                renameMutation.mutate({ id: renamingId, title: renameValue });
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingId(null)}>Cancel</Button>
            <Button onClick={() => renamingId !== null && renameMutation.mutate({ id: renamingId, title: renameValue })}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
