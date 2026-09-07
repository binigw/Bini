import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AnalysisTelemetryPoint } from "@workspace/api-client-react";
import { Activity, AlertTriangle, BrainCircuit, Clock3, FileSearch, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiErrorState } from "@/components/api-error-state";
import { AcousticTrend, ScalarElectricalTrends, VerifiedMCSA, UNAVAILABLE_LABEL } from "@/components/AnalysisGraphs";
import { ExplainFaultCard } from "@/components/ExplainFaultCard";
import { apiFetch } from "@/lib/api-url";

const TARGET_ASSET_NAME = "MTR-0025";
const TARGET_ASSET_ID = 25;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function valueOrUnavailable(value: number | null | undefined, suffix = "") {
  return isFiniteNumber(value) ? `${value.toFixed(2)}${suffix}` : UNAVAILABLE_LABEL;
}

function formatTimestamp(timestamp: string | undefined) {
  if (!timestamp) return UNAVAILABLE_LABEL;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? UNAVAILABLE_LABEL : date.toLocaleString();
}

export function Analysis() {
  const [selectedMotorId, setSelectedMotorId] = useState(String(TARGET_ASSET_ID));
  const [hours, setHours] = useState("72");
  const [activeTraceId, setActiveTraceId] = useState<string>();

  const motorsQuery = useQuery({
    queryKey: ["/api/motors", "analysis"],
    queryFn: async () => {
      const response = await apiFetch("/api/motors");
      if (!response.ok) throw new Error(`Unable to load assets (${response.status})`);
      return response.json() as Promise<Array<{ id: number; name: string; location: string; status: string; healthScore: number }>>;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!motorsQuery.data?.length) return;
    const target = motorsQuery.data.find((motor) => motor.name === TARGET_ASSET_NAME)
      ?? motorsQuery.data.find((motor) => motor.id === TARGET_ASSET_ID)
      ?? motorsQuery.data[0];
    if (target && selectedMotorId === String(TARGET_ASSET_ID) && !motorsQuery.data.some((motor) => motor.id === TARGET_ASSET_ID)) {
      setSelectedMotorId(String(target.id));
    }
  }, [motorsQuery.data, selectedMotorId]);

  const historyQuery = useQuery({
    queryKey: ["/api/telemetry/history", selectedMotorId, hours],
    enabled: Boolean(selectedMotorId),
    queryFn: async () => {
      const params = new URLSearchParams({
        motorId: selectedMotorId,
        hours,
        limit: "500",
      });
      const response = await apiFetch(`/api/telemetry/history?${params.toString()}`);
      if (!response.ok) throw new Error(`Unable to load analysis telemetry (${response.status})`);
      return response.json() as Promise<AnalysisTelemetryPoint[]>;
    },
    refetchInterval: 30000,
  });

  const motorRecords = Array.isArray(motorsQuery.data)
    ? motorsQuery.data.filter((motor) => Boolean(motor) && typeof motor === "object" && typeof motor.id === "number")
    : [];
  const historyRecords = Array.isArray(historyQuery.data)
    ? historyQuery.data.filter((point): point is AnalysisTelemetryPoint => Boolean(point) && typeof point === "object" && typeof point.traceId === "string")
    : [];
  const displayedPoints = useMemo(
    () => [...historyRecords].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
    [historyRecords],
  );
  const activePoint = useMemo(
    () => displayedPoints.find((point) => point.traceId === activeTraceId) ?? displayedPoints[displayedPoints.length - 1],
    [activeTraceId, displayedPoints],
  );
  const waveformPoints = useMemo(
    () => displayedPoints.filter((point) => Array.isArray(point.rawWaveform) && point.rawWaveform.length >= 2),
    [displayedPoints],
  );

  useEffect(() => {
    if (activePoint && activePoint.traceId !== activeTraceId) setActiveTraceId(activePoint.traceId);
    if (!activePoint && activeTraceId) setActiveTraceId(undefined);
  }, [activePoint, activeTraceId]);

  const selectedMotor = motorRecords.find((motor) => String(motor.id) === selectedMotorId);
  const assetName = selectedMotor?.name ?? (selectedMotorId === String(TARGET_ASSET_ID) ? TARGET_ASSET_NAME : "Selected asset");
  const windowStart = displayedPoints[0]?.timestamp;
  const windowEnd = displayedPoints[displayedPoints.length - 1]?.timestamp;
  const isLoading = motorsQuery.isLoading || historyQuery.isLoading;
  const hasError = motorsQuery.isError || historyQuery.isError;
  const safetyTriggers = Array.isArray(activePoint?.safetyTriggers) ? activePoint.safetyTriggers : [];

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Activity className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Advanced Analysis</h1>
            <Badge variant="outline" className="border-primary/40 text-primary">AUDIT MODE</Badge>
          </div>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Evidence-first telemetry review for {assetName}. Every plotted point retains its exact ISO timestamp and backend trace ID.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-2">
          <Select value={selectedMotorId} onValueChange={(value) => {
            setSelectedMotorId(value);
            setActiveTraceId(undefined);
          }}>
            <SelectTrigger className="w-[190px] bg-background">
              <SelectValue placeholder="Select asset" />
            </SelectTrigger>
            <SelectContent>
              {motorRecords.map((motor) => (
                <SelectItem key={motor.id} value={String(motor.id)}>{motor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={hours} onValueChange={(value) => {
            setHours(value);
            setActiveTraceId(undefined);
          }}>
            <SelectTrigger className="w-[145px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">Last 6 hours</SelectItem>
              <SelectItem value="72">Last 3 days</SelectItem>
               <SelectItem value="24">Last 24 hours</SelectItem>
              <SelectItem value="720">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <EvidenceStat label="Displayed points" value={displayedPoints.length ? String(displayedPoints.length) : UNAVAILABLE_LABEL} icon={<Activity className="h-4 w-4 text-primary" />} />
        <EvidenceStat label="Window start" value={formatTimestamp(windowStart)} icon={<Clock3 className="h-4 w-4 text-sky-300" />} />
        <EvidenceStat label="Window end" value={formatTimestamp(windowEnd)} icon={<Clock3 className="h-4 w-4 text-sky-300" />} />
        <EvidenceStat label="Telemetry mode" value={waveformPoints.length ? "Raw waveform available" : "Scalar electrical"} icon={<ShieldCheck className="h-4 w-4 text-amber-300" />} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[380px] w-full" />)}
        </div>
      ) : hasError ? (
        <ApiErrorState message="Unable to load the auditable telemetry window." />
      ) : displayedPoints.length === 0 ? (
        <Card className="border-dashed border-border bg-card">
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center text-center">
            <FileSearch className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">No verified telemetry in this window</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Analysis does not fill gaps with static values. Select a longer window or wait for a persisted telemetry snapshot.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ScalarElectricalTrends
            points={displayedPoints}
            activeTraceId={activeTraceId}
            onSelectPoint={(point) => {
              setActiveTraceId(point.traceId);
            }}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AcousticTrend
              points={displayedPoints}
              onSelectPoint={(point) => {
                setActiveTraceId(point.traceId);
              }}
            />
            {activePoint && Array.isArray(activePoint.rawWaveform) && activePoint.rawWaveform.length >= 2 ? (
              <VerifiedMCSA points={displayedPoints} activePoint={activePoint} />
            ) : (
              <Card className="border-border bg-card shadow-lg">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                    <WavesDisabledIcon />
                      MCSA / Harmonic Spectrum unavailable
                    </CardTitle>
                    {displayedPoints.some((point) => point.isSimulation) && (
                      <Badge className="border-amber-500/60 bg-amber-500/15 text-amber-300 tracking-[0.12em]">
                        SIMULATION DATA
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    FFT / Harmonic Spectrum is rendered only when the selected telemetry snapshot contains a raw_waveform array.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-[230px] items-center justify-center">
                  <div className="max-w-sm text-center text-sm text-muted-foreground">
                    <p className="font-medium">{UNAVAILABLE_LABEL}</p>
                    <p className="mt-1">Scalar current is not a waveform. FFT spectral peaks are withheld to preserve measurement integrity.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card className="border-border bg-card">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileSearch className="h-4 w-4 text-primary" />
                      Active snapshot evidence
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Click any chart point to select the exact snapshot used by Explain This Fault.
                    </CardDescription>
                  </div>
                  {activePoint?.isSimulation && (
                    <Badge className="border-amber-500/60 bg-amber-500/15 text-amber-300 tracking-[0.12em]">SIMULATION DATA</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <EvidenceCell label="Timestamp" value={formatTimestamp(activePoint?.timestamp)} mono />
                <EvidenceCell label="Trace ID" value={activePoint?.traceId ?? UNAVAILABLE_LABEL} mono />
                <EvidenceCell label="Decision" value={activePoint?.faultLabel ?? UNAVAILABLE_LABEL} />
                <EvidenceCell label="Confidence" value={valueOrUnavailable(activePoint?.faultConfidence)} />
                <EvidenceCell label="Current RMS" value={valueOrUnavailable(activePoint?.current, " A")} />
                <EvidenceCell label="THDᵢ" value={valueOrUnavailable(activePoint?.thd, "%")} />
                <EvidenceCell label="Measured dB" value={valueOrUnavailable(activePoint?.db, " dB")} />
                <EvidenceCell label="IF anomaly" value={valueOrUnavailable(activePoint?.ifAnomalyScore)} />
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BrainCircuit className="h-4 w-4 text-violet-300" />
                  Decision authority
                </CardTitle>
                <CardDescription className="mt-1">ML classification and safety rules remain separate evidence sources.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-md border border-violet-400/20 bg-violet-400/5 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Core ML pipeline</p>
                  <p className="mt-1 font-mono text-xs text-violet-200">Isolation Forest → XGBoost → Random Forest → Safety Rules</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-violet-400/30 text-violet-200">ML: {activePoint?.faultLabel ?? UNAVAILABLE_LABEL}</Badge>
                  {safetyTriggers.map((trigger) => (
                    <Badge key={`${trigger.traceId}-${trigger.code}`} variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">
                      <AlertTriangle className="mr-1 h-3 w-3" /> Safety Rule Trigger · {trigger.label}
                    </Badge>
                  ))}
                  {safetyTriggers.length === 0 && <span className="text-xs text-muted-foreground">No safety trigger in selected point</span>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center">
              <ShieldCheck className="h-6 w-6 shrink-0 text-amber-300" />
              <div>
                <p className="font-semibold text-amber-100">RUL Survival Model: Disabled / Pending Survival Model Integration</p>
                <p className="mt-1 text-xs text-amber-100/70">No lifespan, degradation, or failure-time value is inferred on this page.</p>
              </div>
            </CardContent>
          </Card>

           <ExplainFaultCard
             activePoint={activePoint}
             snapshotWindow={displayedPoints}
             snapshotLoading={isLoading}
           />
        </>
      )}
    </div>
  );
}

function EvidenceStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
          {icon}
        </div>
        <p className="mt-2 truncate font-mono text-sm text-foreground" title={value}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EvidenceCell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border/70 bg-black/15 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-xs text-foreground ${mono ? "font-mono" : ""}`} title={value}>{value}</p>
    </div>
  );
}

function WavesDisabledIcon() {
  return <Activity className="h-4 w-4 text-muted-foreground" />;
}