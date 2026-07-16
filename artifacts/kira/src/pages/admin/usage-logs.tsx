import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, AlertCircle, Activity } from "lucide-react";

const LOG_LEVELS = ["all","error","warning","info"];
const LOG_CATEGORIES = ["all","ai","rag","auth","document","vision","database"];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminUsageLogs() {
  const [logLevel, setLogLevel] = useState("all");
  const [logCategory, setLogCategory] = useState("all");

  const analyticsQuery = useQuery({ queryKey: ["admin","analytics"], queryFn: () => apiFetch<any>("/admin/analytics"), refetchInterval: 30000 });
  const logsQuery = useQuery({
    queryKey: ["admin","logs", logLevel, logCategory],
    queryFn: () => apiFetch<any[]>(`/admin/logs?limit=100${logLevel !== "all" ? `&level=${logLevel}` : ""}${logCategory !== "all" ? `&category=${logCategory}` : ""}`),
    refetchInterval: 15000,
  });

  const a = analyticsQuery.data;

  function levelColor(level: string) {
    if (level === "error") return "destructive";
    if (level === "warning") return "secondary";
    return "outline";
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Usage & Logs</h1>
        <p className="text-sm text-muted-foreground">System usage analytics and error logs. No secrets are exposed.</p>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics" className="gap-2"><Activity className="w-4 h-4" />Analytics</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><AlertCircle className="w-4 h-4" />System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          {analyticsQuery.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total AI Requests" value={a?.total_ai_requests ?? 0} />
              <StatCard label="Requests (7 days)" value={a?.recent_ai_requests_7d ?? 0} />
              <StatCard label="Active Users (7d)" value={a?.active_users_7d ?? 0} />
              <StatCard label="Total Conversations" value={a?.total_conversations ?? 0} />
              <StatCard label="Document Uploads" value={a?.total_document_uploads ?? 0} />
              <StatCard label="Image Analyses" value={a?.total_image_analyses ?? 0} />
              <StatCard label="Failed Requests" value={a?.total_failed_requests ?? 0} />
              <StatCard label="Avg Msgs/Conv" value={a?.avg_messages_per_conversation ?? 0} sub="messages per conversation" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <Select value={logLevel} onValueChange={setLogLevel}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{LOG_LEVELS.map(l => <SelectItem key={l} value={l} className="capitalize">{l === "all" ? "All levels" : l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={logCategory} onValueChange={setLogCategory}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{LOG_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c === "all" ? "All categories" : c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {logsQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (logsQuery.data ?? []).length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No logs match the current filters.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden divide-y">
              {(logsQuery.data ?? []).map(log => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-muted/30">
                  <Badge variant={levelColor(log.level) as any} className="text-xs mt-0.5 flex-shrink-0">{log.level}</Badge>
                  <Badge variant="outline" className="text-xs mt-0.5 flex-shrink-0">{log.category}</Badge>
                  <p className="flex-1 text-sm">{log.message}</p>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
