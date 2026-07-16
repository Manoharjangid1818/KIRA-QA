import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { isAdminRole } from '@/lib/types';

// Auth pages
import Login from '@/pages/login';
import Register from '@/pages/register';

// Admin pages
import { AdminLayout } from '@/components/layout/admin-layout';
import AdminDashboard from '@/pages/admin/dashboard';
import AdminUsers from '@/pages/admin/users';
import AdminDepartments from '@/pages/admin/departments';
import AdminProjects from '@/pages/admin/projects';
import AdminKnowledgeBases from '@/pages/admin/knowledge-bases';
import AdminDocuments from '@/pages/admin/documents';
import AdminAccessControl from '@/pages/admin/access-control';
import AdminAIConfig from '@/pages/admin/ai-configuration';
import AdminPrompts from '@/pages/admin/prompt-management';
import AdminUsageLogs from '@/pages/admin/usage-logs';
import AdminSettings from '@/pages/admin/settings';

// User panel
import { UserLayout } from '@/components/layout/user-layout';
import ChatPage from '@/pages/chat/index';

// Not found
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  if (!user) return <Redirect to="/login" />;
  if (isAdminRole(user.role)) return <Redirect to="/admin" />;
  return <Redirect to="/chat" />;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  if (!user) return <Redirect to="/login" />;
  if (!isAdminRole(user.role)) return <Redirect to="/chat" />;
  return <>{children}</>;
}

function UserGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  if (!user) return <Redirect to="/login" />;
  if (isAdminRole(user.role)) return <Redirect to="/admin" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Admin panel */}
      <Route path="/admin">
        <AdminGuard><AdminLayout><AdminDashboard /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/users">
        <AdminGuard><AdminLayout><AdminUsers /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/departments">
        <AdminGuard><AdminLayout><AdminDepartments /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/projects">
        <AdminGuard><AdminLayout><AdminProjects /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/knowledge-bases">
        <AdminGuard><AdminLayout><AdminKnowledgeBases /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/documents">
        <AdminGuard><AdminLayout><AdminDocuments /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/access-control">
        <AdminGuard><AdminLayout><AdminAccessControl /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/ai-configuration">
        <AdminGuard><AdminLayout><AdminAIConfig /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/prompts">
        <AdminGuard><AdminLayout><AdminPrompts /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/usage-logs">
        <AdminGuard><AdminLayout><AdminUsageLogs /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/admin/settings">
        <AdminGuard><AdminLayout><AdminSettings /></AdminLayout></AdminGuard>
      </Route>

      {/* User chat panel */}
      <Route path="/chat">
        <UserGuard><UserLayout><ChatPage /></UserLayout></UserGuard>
      </Route>
      <Route path="/chat/:conversationId">
        <UserGuard><UserLayout><ChatPage /></UserLayout></UserGuard>
      </Route>

      {/* Root redirect */}
      <Route path="/"><RootRedirect /></Route>

      {/* Unknown route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
