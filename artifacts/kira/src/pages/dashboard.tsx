import { useDashboard } from "@/hooks/use-kira-api";
import { format } from "date-fns";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  FileText, 
  ListTree, 
  CheckSquare, 
  Bug,
  ShieldAlert,
  Server,
  Activity,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useDashboard();

  if (isLoading || !dashboard) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-pulse">
        <div className="h-8 bg-muted rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { title: "Conversations", value: dashboard.total_conversations, icon: <MessageSquare className="w-5 h-5 text-muted-foreground" /> },
    { title: "Requirements", value: dashboard.artifacts_by_type.requirement_analysis, icon: <FileText className="w-5 h-5 text-muted-foreground" /> },
    { title: "Test Scenarios", value: dashboard.artifacts_by_type.test_scenario, icon: <ListTree className="w-5 h-5 text-muted-foreground" /> },
    { title: "Test Cases", value: dashboard.artifacts_by_type.test_case, icon: <CheckSquare className="w-5 h-5 text-muted-foreground" /> },
    { title: "Bug Reports", value: dashboard.artifacts_by_type.bug_report, icon: <Bug className="w-5 h-5 text-muted-foreground" /> },
    { title: "Security Tests", value: dashboard.artifacts_by_type.security, icon: <ShieldAlert className="w-5 h-5 text-muted-foreground" /> },
  ];

  const getArtifactIcon = (type: string) => {
    switch(type) {
      case 'requirement_analysis': return <FileText className="w-4 h-4" />;
      case 'test_scenario': return <ListTree className="w-4 h-4" />;
      case 'test_case': return <CheckSquare className="w-4 h-4" />;
      case 'bug_report': return <Bug className="w-4 h-4" />;
      case 'security': return <ShieldAlert className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getArtifactLabel = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Here is the overview of your QA generation activity.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-md border shadow-sm">
          <Server className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">AI Backend:</span>
          {dashboard.ai_provider.configured ? (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {dashboard.ai_provider.model || "Connected"}
            </Badge>
          ) : (
            <Badge variant="destructive">Disconnected</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="col-span-1 border-t-4 border-t-primary shadow-sm hover-elevate">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <CardTitle>Recent Activity</CardTitle>
            </div>
            <CardDescription>Your latest generated artifacts</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.recent_activity.length > 0 ? (
              <div className="space-y-4">
                {dashboard.recent_activity.map(activity => (
                  <Link href={`/saved-results/${activity.id}`} key={activity.id}>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-md">
                          {getArtifactIcon(activity.type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px] md:max-w-[250px]">
                            {activity.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {getArtifactLabel(activity.type)}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(activity.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No activity yet.</p>
                <p className="text-sm mt-1">Generate your first artifact to see it here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm hover-elevate">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Start a new generation task</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/requirement-analyzer">
                <div className="p-4 border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer text-center group">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="font-medium text-sm">Analyze Requirement</div>
                </div>
              </Link>
              <Link href="/test-scenarios">
                <div className="p-4 border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer text-center group">
                  <ListTree className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="font-medium text-sm">Generate Scenarios</div>
                </div>
              </Link>
              <Link href="/test-cases">
                <div className="p-4 border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer text-center group">
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="font-medium text-sm">Draft Test Cases</div>
                </div>
              </Link>
              <Link href="/bug-reports">
                <div className="p-4 border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer text-center group">
                  <Bug className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="font-medium text-sm">Format Bug Report</div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
