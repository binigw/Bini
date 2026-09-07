import {
  getGetSystemSummaryQueryKey,
  getGetTrainingDataStatsQueryKey,
  getGetAnalyticsTrendsQueryKey,
  getListMotorsQueryKey,
  useGetAnalyticsTrends,
  useGetSystemSummary,
  useGetTrainingDataStats,
  useListMotors,
} from "@workspace/api-client-react";
import { Activity, CheckCircle2, Database, Download, FileText, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ApiErrorState } from "@/components/api-error-state";
import { DecisionEngineStatus, latestDecisionMotor } from "@/components/decision-engine-status";

export function Reports() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useGetTrainingDataStats({
    query: { refetchInterval: 30000, queryKey: getGetTrainingDataStatsQueryKey() },
  });
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useGetSystemSummary({
    query: { refetchInterval: 30000, queryKey: getGetSystemSummaryQueryKey() },
  });
  const { data: motors, isLoading: motorsLoading, isError: motorsError } = useListMotors({
    query: { refetchInterval: 30000, queryKey: getListMotorsQueryKey() },
  });
  const { data: trends, isLoading: trendsLoading, isError: trendsError } = useGetAnalyticsTrends(
    { hours: 24 },
    { query: { refetchInterval: 30000, queryKey: getGetAnalyticsTrendsQueryKey({ hours: 24 }) } },
  );

  const isLoading = statsLoading || summaryLoading || motorsLoading || trendsLoading;
  const isError = statsError || summaryError || motorsError || trendsError;
  const motorRecords = Array.isArray(motors) ? motors : [];
  const trendRecords = Array.isArray(trends)
    ? trends.filter((point) => Boolean(point) && typeof point === "object")
    : [];
  const coverageRecords = Array.isArray(stats?.classCoverage)
    ? stats.classCoverage.filter((item) => Boolean(item) && typeof item === "object")
    : [];
  const latestMotor = latestDecisionMotor(motorRecords);
  const exportUrl = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}api/training-data/export.csv`;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
            <FileText className="h-8 w-8 text-primary" />
            Operations Reports
          </h1>
          <p className="mt-2 text-muted-foreground">
            Live system health, telemetry history, and Decision Engine coverage.
          </p>
        </div>
        <Button asChild variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
          <a href={exportUrl}>
            <Download className="mr-2 h-4 w-4" />
            Export Live Dataset
          </a>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 w-full" />)}
        </div>
      ) : isError ? (
        <ApiErrorState message="Unable to load the live operations report." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <ReportMetric icon={<Database className="h-5 w-5 text-primary" />} label="Captured samples" value={formatCount(stats?.totalSamples)} />
            <ReportMetric icon={<Activity className="h-5 w-5 text-primary" />} label="24h telemetry points" value={formatCount(trendRecords.length)} />
            <ReportMetric icon={<ShieldAlert className="h-5 w-5 text-destructive" />} label="Relay trips" value={formatCount(stats?.relayTripCount)} />
            <ReportMetric icon={<CheckCircle2 className="h-5 w-5 text-primary" />} label="Training coverage" value={stats?.motorCoverage?.coveragePct == null ? "—" : `${stats.motorCoverage.coveragePct}%`} />
          </div>

          <DecisionEngineStatus motor={latestMotor} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Live System Summary</CardTitle>
                <CardDescription>Current values from the system summary and telemetry history endpoints.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <SummaryRow label="Average health" value={`${summary?.averageHealthScore ?? "—"}%`} />
                <SummaryRow label="Health trend" value={formatHealthTrend(summary?.healthTrend)} />
                <SummaryRow label="Active alerts" value={String(summary?.activeAlertCount ?? "—")} />
                <SummaryRow label="Predictive risk" value={summary?.predictiveRisk ?? "—"} />
                <SummaryRow label="Telemetry history average" value={trendRecords.length ? `${(trendRecords.reduce((sum, point) => sum + (typeof point.healthScore === "number" ? point.healthScore : 0), 0) / trendRecords.length).toFixed(1)}%` : "No data"} />
                <SummaryRow label="Training readiness" value={stats?.isReadyForTraining ? "Ready" : "Not ready"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fault-Class Coverage</CardTitle>
                <CardDescription>Live training-data distribution by Decision Engine label.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {coverageRecords.map((item) => (
                    <div key={item.class} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-sm text-foreground">{item.class}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{formatCount(item.samples)} samples</span>
                        <Badge variant={item.sufficientForTraining ? "default" : "secondary"}>
                          {item.sufficientForTraining ? "Sufficient" : "Building"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Motor Report</CardTitle>
              <CardDescription>Current motor health, fault label, and latest Decision Engine timestamp from the live motor registry.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-black/20 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-medium">Motor</th>
                      <th className="px-6 py-3 font-medium">Health</th>
                      <th className="px-6 py-3 font-medium">Fault label</th>
                      <th className="px-6 py-3 font-medium">Model</th>
                      <th className="px-6 py-3 font-medium">Relay</th>
                      <th className="px-6 py-3 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {motorRecords.map((motor) => (
                      <tr key={motor.id} className="hover:bg-muted/20">
                        <td className="px-6 py-3 font-medium">{motor.name}</td>
                        <td className="px-6 py-3 font-mono">{motor.healthScore}%</td>
                        <td className="px-6 py-3">{motor.decisionFaultLabel ?? "No Decision Engine result"}</td>
                        <td className="px-6 py-3">{motor.decisionMlActive == null ? "—" : motor.decisionMlActive ? "ML active" : "Rule fallback"}</td>
                        <td className={`px-6 py-3 font-semibold ${motor.decisionEmergencyTrip ? "text-destructive" : "text-primary"}`}>
                          {motor.decisionEmergencyTrip == null ? "—" : motor.decisionEmergencyTrip ? "TRIPPED" : "Normal"}
                        </td>
                        <td className="px-6 py-3 text-xs text-muted-foreground">
                          {motor.decisionUpdatedAt ? new Date(motor.decisionUpdatedAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ReportMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className="rounded-md bg-primary/10 p-2">{icon}</div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-black/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function formatCount(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
}

function formatHealthTrend(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value > 0 ? "+" : ""}${value.toFixed(1)} pts`
    : "No prior-week history";
}