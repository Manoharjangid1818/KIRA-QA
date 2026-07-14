import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';

// Pages
import Login from '@/pages/login';
import Register from '@/pages/register';
import Dashboard from '@/pages/dashboard';
import Chat from '@/pages/chat';
import RequirementAnalyzer from '@/pages/requirement-analyzer';
import TestScenarios from '@/pages/test-scenarios';
import TestCases from '@/pages/test-cases';
import BugReports from '@/pages/bug-reports';
import SavedResults from '@/pages/saved-results';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected routes wrapped in AppLayout */}
      <Route path="/dashboard">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/chat">
        <AppLayout><Chat /></AppLayout>
      </Route>
      <Route path="/requirement-analyzer">
        <AppLayout><RequirementAnalyzer /></AppLayout>
      </Route>
      <Route path="/test-scenarios">
        <AppLayout><TestScenarios /></AppLayout>
      </Route>
      <Route path="/test-cases">
        <AppLayout><TestCases /></AppLayout>
      </Route>
      <Route path="/bug-reports">
        <AppLayout><BugReports /></AppLayout>
      </Route>
      <Route path="/saved-results">
        <AppLayout><SavedResults /></AppLayout>
      </Route>
      <Route path="/saved-results/:id">
        <AppLayout><SavedResults /></AppLayout>
      </Route>
      
      {/* Default redirect to dashboard or login handled by Auth hook in AppLayout/components */}
      <Route path="/">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      
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
