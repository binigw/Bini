import { Link, useLocation } from "wouter";
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Activity, 
  Bell, 
  LineChart, 
  ChartNoAxesCombined,
  FileWarning, 
  FileText,
  Users, 
  Settings,
  Menu
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useGetLiveAlerts,
  useGetSystemSummary,
  useHealthCheck,
  getGetLiveAlertsQueryKey,
  getGetSystemSummaryQueryKey,
  getHealthCheckQueryKey,
} from "@workspace/api-client-react";
import { useI18n } from "@/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeRoutePath, ROUTES } from "@/lib/routes";

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useI18n();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentRoute = normalizeRoutePath(location);

  const { data: alerts = [] } = useGetLiveAlerts({
    query: { refetchInterval: 30000, queryKey: getGetLiveAlertsQueryKey() },
  });
  const activeAlertCount = Array.isArray(alerts) ? alerts.length : 0;
  const { data: summary } = useGetSystemSummary({
    query: { refetchInterval: 30000, queryKey: getGetSystemSummaryQueryKey() },
  });
  const { isError: isBackendError, isLoading: isBackendLoading } = useHealthCheck({
    query: { refetchInterval: 30000, queryKey: getHealthCheckQueryKey() },
  });
  const systemNeedsAttention =
    isBackendError ||
    (summary?.stoppedCount ?? 0) > 0 ||
    (summary?.highPriorityAlerts ?? 0) > 0;
  const systemStatusLabel = isBackendLoading
    ? t("system.checking")
    : isBackendError
      ? t("system.offline")
      : systemNeedsAttention
        ? t("system.attention")
        : t("system.operational");
  
  const navItems: NavItem[] = [
    { title: t("nav.dashboard"), path: ROUTES.dashboard, icon: LayoutDashboard },
    { title: t("nav.machines"), path: ROUTES.machines, icon: Activity },
    { title: t("nav.alerts"), path: ROUTES.alerts, icon: Bell, badge: activeAlertCount },
    { title: t("nav.analytics"), path: ROUTES.analytics, icon: LineChart },
    { title: t("nav.advancedAnalysis"), path: ROUTES.analysis, icon: ChartNoAxesCombined },
    { title: t("nav.faultLogs"), path: ROUTES.faultLogs, icon: FileWarning },
    { title: t("nav.reports"), path: ROUTES.reports, icon: FileText },
    { title: t("nav.personnel"), path: ROUTES.personnel, icon: Users },
    { title: t("nav.settings"), path: ROUTES.settings, icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border bg-sidebar transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-6">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">VoltGuard AI</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer ${
                currentRoute === item.path
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                  : "text-sidebar-foreground/70"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.title}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-4 bg-sidebar-accent/50">
          <div className="flex items-center gap-3 text-sm font-medium">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemNeedsAttention ? "bg-destructive" : "bg-primary"}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${systemNeedsAttention ? "bg-destructive" : "bg-primary"}`}></span>
            </span>
            <span className="text-sidebar-foreground">
              {systemStatusLabel}
            </span>
          </div>
          <div className={`ml-6 mt-1 text-xs ${isBackendError ? "text-destructive" : "text-sidebar-foreground/60"}`}>
             {isBackendLoading ? t("system.checkingConnection") : isBackendError ? t("system.unavailable") : t("system.connected")}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6 md:hidden">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">VoltGuard AI</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="h-6 w-6" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <div className="mb-4 flex justify-end">
            <Select value={language} onValueChange={(value) => setLanguage(value as "en" | "am")}>
              <SelectTrigger className="w-[150px] bg-card" aria-label={t("language.label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("language.english")}</SelectItem>
                <SelectItem value="am">{t("language.amharic")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mx-auto max-w-7xl h-full">
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
