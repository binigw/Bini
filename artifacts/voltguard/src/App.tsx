import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AppLayout } from '@/components/layout/app-layout';

import { Dashboard } from '@/pages/dashboard';
import { Machines } from '@/pages/machines';
import { Alerts } from '@/pages/alerts';
import { Analytics } from '@/pages/analytics';
import { Analysis } from '@/pages/analysis';
import { FaultLogs } from '@/pages/fault-logs';
import { Personnel } from '@/pages/personnel';
import { Settings } from '@/pages/settings';
import { Reports } from '@/pages/reports';
import { LanguageProvider } from '@/i18n';
import { ROUTES } from '@/lib/routes';

const queryClient = new QueryClient();

function getRouterBase(baseUrl: string | undefined): string {
  const normalizedBaseUrl = baseUrl?.trim() ?? "";

  if (
    normalizedBaseUrl === "" ||
    normalizedBaseUrl === "/" ||
    normalizedBaseUrl === "." ||
    normalizedBaseUrl === "./"
  ) {
    return "";
  }

  return normalizedBaseUrl.replace(/\/+$/, "");
}

const routerBase = getRouterBase(import.meta.env.BASE_URL);

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path={ROUTES.dashboard} component={Dashboard} />
        <Route path={ROUTES.machines} component={Machines} />
        <Route path={ROUTES.alerts} component={Alerts} />
        <Route path={ROUTES.analytics} component={Analytics} />
        <Route path={ROUTES.analysis} component={Analysis} />
        <Route path={ROUTES.faultLogs} component={FaultLogs} />
        <Route path={ROUTES.personnel} component={Personnel} />
        <Route path={ROUTES.reports} component={Reports} />
        <Route path={ROUTES.settings} component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={routerBase}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
