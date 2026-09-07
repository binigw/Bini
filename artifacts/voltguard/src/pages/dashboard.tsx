import { useGetSystemSummary, useListMotors, useGetLiveAlerts, useListFaults, useGetAnalyticsTrends, getGetSystemSummaryQueryKey, getListMotorsQueryKey, getGetLiveAlertsQueryKey, getListFaultsQueryKey, getGetAnalyticsTrendsQueryKey } from "@workspace/api-client-react";
import type { AnalysisTelemetryPoint } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle, Cpu, BrainCircuit, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { MotorStatusBadge, HealthScoreBadge, SeverityBadge } from "@/components/ui/badges";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiErrorState } from "@/components/api-error-state";
import { DecisionEngineStatus, latestDecisionMotor } from "@/components/decision-engine-status";
import { ExplainFaultCard } from "@/components/ExplainFaultCard";
import { useI18n } from "@/i18n";
import { apiFetch } from "@/lib/api-url";

export function Dashboard() {
  const { t, fault, alertMessage, relativeTime } = useI18n();
  const { data: summary, isLoading: isLoadingSummary } = useGetSystemSummary({
    query: { refetchInterval: 30000, queryKey: getGetSystemSummaryQueryKey() }
  });
  const { data: motors, isLoading: isLoadingMotors, isError: isMotorsError } = useListMotors({
    query: { refetchInterval: 30000, queryKey: getListMotorsQueryKey() },
  });
  const { data: alerts, isLoading: isLoadingAlerts, isError: isAlertsError } = useGetLiveAlerts({
    query: { refetchInterval: 30000, queryKey: getGetLiveAlertsQueryKey() }
  });
  const { data: faults, isError: isFaultsError } = useListFaults({
    query: { refetchInterval: 30000, queryKey: getListFaultsQueryKey() },
  });
  const { data: telemetryTrends, isError: isTelemetryError } = useGetAnalyticsTrends(
    { hours: 24 },
    { query: { refetchInterval: 30000, queryKey: getGetAnalyticsTrendsQueryKey({ hours: 24 }) } },
  );

  const motorRecords = Array.isArray(motors) ? motors : [];
  const alertRecords = Array.isArray(alerts) ? alerts : [];
  const faultRecords = Array.isArray(faults) ? faults : [];
  
  const [selectedFaultId, setSelectedFaultId] = useState<number | null>(null);

  // Auto-select latest fault
  useEffect(() => {
    if (faultRecords.length > 0 && !selectedFaultId) {
      setSelectedFaultId(faultRecords[0].id);
    }
  }, [faultRecords, selectedFaultId]);

  const selectedFault = faultRecords.find(f => f.id === selectedFaultId);
  const selectedDecisionMotor = selectedFault
    ? motorRecords.find((motor) => motor.id === selectedFault.motorId)
    : undefined;
  const shouldShowFaultActions = motorRecords.length > 0 || faultRecords.length > 0;
  const telemetryQuery = useQuery({
    queryKey: ["/api/telemetry/history", "dashboard", selectedFault?.motorId],
    enabled: Boolean(selectedFault?.motorId),
    queryFn: async () => {
      const params = new URLSearchParams({
        motorId: String(selectedFault!.motorId),
        hours: "24",
        limit: "500",
      });
      const response = await apiFetch(`/api/telemetry/history?${params.toString()}`);
      if (!response.ok) throw new Error(`Unable to load active telemetry (${response.status})`);
      return response.json() as Promise<AnalysisTelemetryPoint[]>;
    },
    refetchInterval: 30000,
  });
  const dashboardTelemetry = [...(telemetryQuery.data ?? [])].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );
  const activeTelemetry = dashboardTelemetry[0];
  const trendByMotorId = useMemo(() => {
    const trends = new Map<number, { value: number }[]>();
    for (const point of telemetryTrends ?? []) {
      const motorTrend = trends.get(point.motorId) ?? [];
      motorTrend.push({ value: point.healthScore });
      trends.set(point.motorId, motorTrend);
    }
    return trends;
  }, [telemetryTrends]);
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {t("dashboard.title")}
          </h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 bg-black/40 border border-border px-4 py-2 rounded-full font-mono text-sm shadow-[0_0_15px_rgba(26,214,104,0.1)]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
          </span>
           <span className="text-primary font-bold tracking-wider">{t("dashboard.live")}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
           title={t("dashboard.activeMotors")}
          value={isLoadingSummary ? <Skeleton className="h-8 w-16" /> : `${summary?.runningCount || 0} / ${summary?.totalMotors || 0}`}
           subtitle={t("dashboard.motorsHealthy")}
          icon={<Cpu className="h-5 w-5 text-primary" />}
        />
        <StatCard 
           title={t("dashboard.avgHealth")}
          value={
            isLoadingSummary ? (
              <Skeleton className="h-8 w-16" />
            ) : typeof summary?.averageHealthScore === "number" ? (
              `${summary.averageHealthScore.toFixed(1)}%`
            ) : (
               t("dashboard.unavailable")
            )
          }
           subtitle={summary?.healthTrend == null
             ? t("dashboard.noHistory")
             : `${summary.healthTrend > 0 ? "↑" : summary.healthTrend < 0 ? "↓" : "→"} ${Math.abs(summary.healthTrend).toFixed(1)} ${t("dashboard.vsLastWeek")}`}
          icon={<HeartPulseIcon className="h-5 w-5 text-primary" />}
        />
        <StatCard 
           title={t("dashboard.activeAlerts")}
          value={isLoadingSummary ? <Skeleton className="h-8 w-16" /> : summary?.activeAlertCount || 0}
           subtitle={`${summary?.highPriorityAlerts || 0} ${t("dashboard.critical")}, ${summary?.mediumPriorityAlerts || 0} ${t("dashboard.warning")}`}
          icon={<AlertTriangle className={`h-5 w-5 ${summary?.activeAlertCount && summary.activeAlertCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />}
          alert={!!(summary?.activeAlertCount && summary.activeAlertCount > 0)}
        />
        <StatCard 
           title={t("dashboard.predictiveRisk")}
           value={isLoadingSummary ? <Skeleton className="h-8 w-24" /> : fault(summary?.predictiveRisk || "Low")}
           subtitle={summary?.predictiveRisk === "High Risk"
             ? t("dashboard.riskHighDetail")
             : summary?.predictiveRisk === "Medium Risk"
               ? t("dashboard.riskMediumDetail")
               : t("dashboard.riskLowDetail")}
          icon={<BrainCircuit className={`h-5 w-5 ${summary?.predictiveRisk === 'High' ? 'text-destructive' : 'text-[hsl(var(--chart-2))]'}`} />}
          alert={summary?.predictiveRisk === 'High'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Table */}
        <Card className="col-span-1 lg:col-span-2 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
             <CardTitle className="text-lg">{t("dashboard.machineGrid")}</CardTitle>
             <Button variant="ghost" size="sm" className="text-xs">{t("dashboard.viewAll")}</Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingMotors ? (
              <div className="p-6 space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : isMotorsError || isTelemetryError ? (
               <ApiErrorState message={t("dashboard.telemetryError")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-black/20 border-b border-border">
                    <tr>
                       <th className="px-4 py-3 font-medium">{t("dashboard.machine")}</th>
                       <th className="px-4 py-3 font-medium">{t("dashboard.status")}</th>
                       <th className="px-4 py-3 font-medium">{t("dashboard.healthScore")}</th>
                       <th className="px-4 py-3 font-medium">{t("dashboard.telemetryTrend")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {motorRecords.slice(0, 8).map((motor) => (
                      <tr key={motor.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{motor.name}</div>
                          <div className="text-xs text-muted-foreground">{motor.location}</div>
                        </td>
                        <td className="px-4 py-3">
                          <MotorStatusBadge status={motor.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={motor.healthScore} 
                              className="h-2 w-16"
                              indicatorColor={motor.healthScore < 50 ? 'bg-destructive' : motor.healthScore < 80 ? 'bg-[hsl(var(--chart-2))]' : 'bg-primary'}
                            />
                            <HealthScoreBadge score={motor.healthScore} />
                          </div>
                        </td>
                        <td className="px-4 py-3 w-32 h-12">
                          <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={trendByMotorId.get(motor.id) ?? []}>
                              <YAxis domain={['auto', 'auto']} hide />
                              <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke={motor.healthScore < 50 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} 
                                strokeWidth={2} 
                                dot={false} 
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Alerts Panel */}
        <Card className="col-span-1 border-border bg-card flex flex-col h-[400px]">
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-lg flex items-center justify-between">
               {t("dashboard.liveAlerts")}
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                 {alertRecords.length} {t("dashboard.active")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {isLoadingAlerts ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : isAlertsError ? (
               <ApiErrorState message={t("dashboard.alertsError")} />
              ) : alertRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                <CheckCircle className="h-10 w-10 text-primary mb-2 opacity-50" />
                 <p>{t("dashboard.noAlerts")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {alertRecords.slice(0, 10).map((alert) => (
                  <div key={alert.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={alert.severity} />
                        <span className="font-semibold text-sm">{alert.motorName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                         {relativeTime(new Date(alert.createdAt))}
                      </span>
                    </div>
                    <div className="text-sm text-foreground/80 mt-1 line-clamp-2">
                      {alertMessage(alert.faultType, alert.message)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DecisionEngineStatus
        motor={selectedFault ? selectedDecisionMotor : latestDecisionMotor(motorRecords)}
      />

         {/* AI explanation uses the same verified snapshot endpoint as Advanced Analysis. */}
      {isFaultsError ? (
        <ApiErrorState message={t("dashboard.faultsError")} />
       ) : shouldShowFaultActions && (
         <ExplainFaultCard
           activePoint={activeTelemetry}
           snapshotWindow={dashboardTelemetry}
           titleKey="dashboard.explainFault"
           descriptionKey="dashboard.explainDescription"
           snapshotLoading={telemetryQuery.isLoading}
           snapshotError={telemetryQuery.error instanceof Error ? telemetryQuery.error.message : undefined}
         />
      )}
    </div>
  );
}
function StatCard({ title, value, subtitle, icon, alert }: { title: string, value: React.ReactNode, subtitle: string, icon: React.ReactNode, alert?: boolean }) {
  return (
    <Card className={`border-border bg-card ${alert ? 'border-destructive/50 shadow-[0_0_10px_rgba(255,42,42,0.1)]' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <div className={`p-2 rounded-md ${alert ? 'bg-destructive/10' : 'bg-primary/10'}`}>
            {icon}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </CardContent>
    </Card>
  );
}
function HeartPulseIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  );
}
