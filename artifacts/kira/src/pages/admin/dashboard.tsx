import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, MessageSquare, BookOpen, FileText, FolderKanban,
  Building2, AlertCircle, HardDrive, CheckCircle2, TrendingUp,
} from "lucide-react";

interface Stats {
  total_users: number; active_users: number; total_conversations: number;
  total_messages: number; total_knowledge_bases: number; total_documents: number;
  total_projects: number; total_departments: number; failed_documents: number;
  system_status: string;
}

interface Activity {
  recent_users: any[]; recent_documents: any[]; recent_errors: any[]; recent_kb_updates: any[];
}

export default function AdminDashboard() {
  const statsQuery = useQuery<Stats>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => apiFetch("/admin/dashboard"),
    refetchInterval: 30000,
  });
  const activityQuery = useQuery<Activity>({
    queryKey: ["admin", "dashboard", "activity"],
    queryFn: () => apiFetch("/admin/dashboard/recent-activity"),
    refetchInterval: 30000,
  });

  const stats = statsQuery.data;
  const activity = activityQuery.data;

  const statCards = stats ? [
    { label: "Total Users", value: stats.total_users, sub: `${stats.active_users} active`, icon: Users, color: "text-blue-500" },
    { label: "Conversations", value: stats.total_conversations, sub: `${stats.total_messages} messages`, icon: MessageSquare, color: "text-purple-500" },
    { label: "Knowledge Bases", value: stats.total_knowledge_bases, sub: `${stats.total_documents} documents`, icon: BookOpen, color: "text-green-500" },
    { label: "Projects", value: stats.total_projects, sub: `${stats.total_departments} departments`, icon: FolderKanban, color: "text-orange-500" },
    { label: "Failed Documents", value: stats.failed_documents, sub: "need reprocessing", icon: AlertCircle, color: "text-red-500" },
    { label: "System Status", value: stats.system_status === "ok" ? "Online" : "Issue", sub: "all services", icon: CheckCircle2, color: stats.system_status === "ok" ? "text-green-500" : "text-red-500" },
  ] : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">KIRA system overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statsQuery.isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
          : statCards.map(card => (
            <Card key={card.label}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold mt-1">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                  </div>
                  <card.icon className={`w-8 h-8 ${card.color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            {activityQuery.isLoading ? <Skeleton className="h-32" /> : (
              <div className="space-y-2">
                {(activity?.recent_users ?? []).length === 0
                  ? <p className="text-xs text-muted-foreground">No recent users</p>
                  : (activity?.recent_users ?? []).map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-xs">{u.full_name}</p>
                        <p className="text-muted-foreground text-xs">{u.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Document Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            {activityQuery.isLoading ? <Skeleton className="h-32" /> : (
              <div className="space-y-2">
                {(activity?.recent_documents ?? []).length === 0
                  ? <p className="text-xs text-muted-foreground">No recent uploads</p>
                  : (activity?.recent_documents ?? []).map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[160px] font-medium">{d.file_name}</span>
                      <Badge
                        variant={d.processing_status === "ready" ? "default" : d.processing_status === "failed" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {d.processing_status}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Errors</CardTitle>
          </CardHeader>
          <CardContent>
            {activityQuery.isLoading ? <Skeleton className="h-32" /> : (
              <div className="space-y-2">
                {(activity?.recent_errors ?? []).length === 0
                  ? <p className="text-xs text-muted-foreground text-green-600">No recent errors ✓</p>
                  : (activity?.recent_errors ?? []).map((e: any) => (
                    <div key={e.id} className="text-xs">
                      <span className="text-destructive font-medium">[{e.category}]</span>
                      <span className="text-muted-foreground ml-1 truncate">{e.message}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Knowledge Base Updates</CardTitle>
          </CardHeader>
          <CardContent>
            {activityQuery.isLoading ? <Skeleton className="h-32" /> : (
              <div className="space-y-2">
                {(activity?.recent_kb_updates ?? []).length === 0
                  ? <p className="text-xs text-muted-foreground">No recent updates</p>
                  : (activity?.recent_kb_updates ?? []).map((kb: any) => (
                    <div key={kb.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{kb.name}</span>
                      <span className="text-muted-foreground">{new Date(kb.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
