import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, Radio, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisSafetyTrigger, AnalysisTelemetryPoint } from "@workspace/api-client-react";

export const UNAVAILABLE_LABEL = "Unavailable / Insufficient Data";

type ChartProps = {
  points: AnalysisTelemetryPoint[];
  activeTraceId?: string;
  onSelectPoint: (point: AnalysisTelemetryPoint) => void;
};

const chartColors = {
  current: "hsl(var(--chart-1))",
  thd: "hsl(var(--chart-2))",
  phaseA: "hsl(var(--chart-4))",
  phaseB: "hsl(var(--chart-5))",
  phaseC: "hsl(var(--destructive))",
  waveform: "hsl(var(--chart-1))",
};

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatValue(value: number | null | undefined, suffix = "") {
  return hasNumber(value) ? `${value.toFixed(2)}${suffix}` : UNAVAILABLE_LABEL;
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? UNAVAILABLE_LABEL
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SimulationBadge() {
  return (
    <Badge className="border-amber-500/60 bg-amber-500/15 text-amber-300 tracking-[0.12em]">
      SIMULATION DATA
    </Badge>
  );
}

function SafetyTags({ triggers }: { triggers: AnalysisSafetyTrigger[] }) {
  if (triggers.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Safety rule triggers">
      {triggers.map((trigger) => (
        <Badge
          key={`${trigger.traceId}-${trigger.code}`}
          variant="outline"
          className="border-destructive/50 bg-destructive/10 text-destructive"
        >
          <AlertTriangle className="mr-1 h-3 w-3" />
          Safety Rule Trigger · {trigger.label}
        </Badge>
      ))}
    </div>
  );
}

function ChartShell({
  title,
  description,
  icon,
  points,
  children,
  availability,
  hasUnavailable,
}: Pick<ChartProps, "points"> & {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  availability: boolean;
  hasUnavailable?: boolean;
}) {
  const isSimulation = points.some((point) => point.isSimulation);
  const triggers = points.flatMap((point) => point.safetyTriggers);
  const uniqueTriggers = triggers.filter(
    (trigger, index, all) =>
      all.findIndex((candidate) => `${candidate.traceId}-${candidate.code}` === `${trigger.traceId}-${trigger.code}`) === index,
  );

  return (
    <Card className="border-border bg-card shadow-lg">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {icon}
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          {isSimulation && <SimulationBadge />}
        </div>
        <SafetyTags triggers={uniqueTriggers} />
      </CardHeader>
      <CardContent className="h-[320px] pt-4">
        {!availability ? (
          <UnavailableChart />
        ) : (
          <div className="flex h-full flex-col">
            {hasUnavailable && (
              <p className="mb-2 text-[11px] text-amber-200/80">
                Missing measurements: {UNAVAILABLE_LABEL}. Gaps are preserved; no values are interpolated.
              </p>
            )}
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UnavailableChart() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-black/20 px-6 text-center">
      <Activity className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">{UNAVAILABLE_LABEL}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
        No verified measurements are available for this metric in the displayed window.
      </p>
    </div>
  );
}

function chartPointFor(state: any): AnalysisTelemetryPoint | null {
  const payload = state?.activePayload?.[0]?.payload;
  return payload && typeof payload.traceId === "string" ? payload as AnalysisTelemetryPoint : null;
}

function safetyPoint(point: AnalysisTelemetryPoint, key: "current" | "thd" | "db") {
  const value = point[key];
  const triggerCode = key === "current"
    ? "overcurrent"
    : key === "thd"
      ? "high_thd"
      : "high_vibration";
  return hasNumber(value) && point.safetyTriggers.some((trigger) => trigger.code === triggerCode)
    ? value
    : undefined;
}

function AuditTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as AnalysisTelemetryPoint | undefined;
  if (!point) return null;
  return (
    <div className="max-w-xs rounded-lg border border-border bg-popover p-3 text-xs shadow-xl">
      <p className="font-mono text-[10px] text-muted-foreground">{point.timestamp}</p>
      <p className="mt-1 font-mono text-[10px] text-primary">Trace ID: {point.traceId}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="mt-2 flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-mono text-foreground">
            {formatValue(typeof entry.value === "number" ? entry.value : null, entry.unit ?? "")}
          </span>
        </div>
      ))}
      {point.safetyTriggers.length > 0 && (
        <div className="mt-3 border-t border-border pt-2 text-destructive">
          <p className="font-semibold">Safety Rule Trigger</p>
          {point.safetyTriggers.map((trigger) => (
            <p key={trigger.code}>{trigger.label}: {trigger.threshold}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function lineChartProps(points: AnalysisTelemetryPoint[], onSelectPoint: ChartProps["onSelectPoint"]) {
  return {
    data: points,
    margin: { top: 10, right: 12, left: -16, bottom: 0 },
    onClick: (state: any) => {
      const point = chartPointFor(state);
      if (point) onSelectPoint(point);
    },
  };
}

export function ScalarElectricalTrends({ points, activeTraceId, onSelectPoint }: ChartProps) {
  const currentPoints = points.map((point) => ({
    ...point,
    currentValue: point.current,
    thdValue: point.thd,
    phaseA: point.phaseCurrentsA?.[0] ?? null,
    phaseB: point.phaseCurrentsA?.[1] ?? null,
    phaseC: point.phaseCurrentsA?.[2] ?? null,
  }));
  const hasCurrent = currentPoints.some((point) => hasNumber(point.currentValue));
  const hasThd = currentPoints.some((point) => hasNumber(point.thdValue));
  const hasPhase = currentPoints.some((point) => point.phaseCurrentsA?.some(hasNumber));
  const currentHasUnavailable = currentPoints.some((point) => !hasNumber(point.currentValue));
  const thdHasUnavailable = currentPoints.some((point) => !hasNumber(point.thdValue));
  const phaseHasUnavailable = currentPoints.some((point) =>
    !point.phaseCurrentsA ||
    point.phaseCurrentsA.length < 3 ||
    point.phaseCurrentsA.slice(0, 3).some((value) => !hasNumber(value)),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Radio className="h-4 w-4 text-primary" />
        Scalar Electrical Monitoring
        <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
          · FFT/MCSA withheld: no raw_waveform in this window
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartShell
          title="Current RMS"
          description="Measured supply current; values are not interpolated."
          icon={<Activity className="h-4 w-4 text-primary" />}
          points={points}
          availability={hasCurrent}
          hasUnavailable={currentHasUnavailable}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...lineChartProps(currentPoints, onSelectPoint)}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={28} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit=" A" />
              <Tooltip content={<AuditTooltip />} />
               <Line dataKey="currentValue" name="Current RMS" unit=" A" stroke={chartColors.current} strokeWidth={2} dot={(props: any) => {
                 const { key: _key, dataKey: _dataKey, ...circleProps } = props;
                 return (
                   <circle key={_key} {...circleProps} r={props.payload?.traceId === activeTraceId ? 5 : 2} fill={chartColors.current} stroke={props.payload?.safetyTriggers?.some((trigger: any) => trigger.code === "overcurrent") ? "hsl(var(--destructive))" : chartColors.current} strokeWidth={2} />
                 );
               }} connectNulls={false} />
              {currentPoints.map((point) => {
                const value = safetyPoint(point, "current");
                return value === undefined ? null : <ReferenceDot key={`current-trigger-${point.traceId}`} x={point.timestamp} y={value} r={6} fill="hsl(var(--destructive))" stroke="none" />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="THDᵢ"
          description="Total harmonic distortion from the scalar telemetry packet."
          icon={<Waves className="h-4 w-4 text-amber-300" />}
          points={points}
          availability={hasThd}
          hasUnavailable={thdHasUnavailable}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...lineChartProps(currentPoints, onSelectPoint)}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={28} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
              <Tooltip content={<AuditTooltip />} />
               <Line dataKey="thdValue" name="THDᵢ" unit="%" stroke={chartColors.thd} strokeWidth={2} dot={(props: any) => {
                 const { key: _key, dataKey: _dataKey, ...circleProps } = props;
                 return (
                   <circle key={_key} {...circleProps} r={props.payload?.traceId === activeTraceId ? 5 : 2} fill={chartColors.thd} stroke={props.payload?.safetyTriggers?.some((trigger: any) => trigger.code === "high_thd") ? "hsl(var(--destructive))" : chartColors.thd} strokeWidth={2} />
                 );
               }} connectNulls={false} />
              {currentPoints.map((point) => {
                const value = safetyPoint(point, "thd");
                return value === undefined ? null : <ReferenceDot key={`thd-trigger-${point.traceId}`} x={point.timestamp} y={value} r={6} fill="hsl(var(--destructive))" stroke="none" />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="Phase Currents"
          description="Three-phase RMS values when supplied by the telemetry payload."
          icon={<Activity className="h-4 w-4 text-sky-300" />}
          points={points}
          availability={hasPhase}
          hasUnavailable={phaseHasUnavailable}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...lineChartProps(currentPoints, onSelectPoint)}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={28} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit=" A" />
              <Tooltip content={<AuditTooltip />} />
              <Line dataKey="phaseA" name="Phase A" unit=" A" stroke={chartColors.phaseA} strokeWidth={2} dot={false} connectNulls={false} />
              <Line dataKey="phaseB" name="Phase B" unit=" A" stroke={chartColors.phaseB} strokeWidth={2} dot={false} connectNulls={false} />
              <Line dataKey="phaseC" name="Phase C" unit=" A" stroke={chartColors.phaseC} strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </div>
  );
}

function computeSpectrum(point: AnalysisTelemetryPoint) {
  const waveform = point.rawWaveform ?? [];
  const sampleCount = Math.min(waveform.length, 1024);
  if (sampleCount < 2) return [];
  const sample = waveform.slice(0, sampleCount);
  const mean = sample.reduce((sum, value) => sum + value, 0) / sample.length;
  const bins = Math.min(48, Math.floor(sampleCount / 2));
  const sampleRate = (point.frequency ?? 50) * sampleCount;
  return Array.from({ length: bins }, (_, bin) => {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      const angle = (2 * Math.PI * bin * index) / sampleCount;
      const value = sample[index] - mean;
      real += value * Math.cos(angle);
      imaginary -= value * Math.sin(angle);
    }
    return {
      frequencyHz: (bin * sampleRate) / sampleCount,
      magnitude: Math.sqrt(real * real + imaginary * imaginary) / sampleCount,
      timestamp: point.timestamp,
      traceId: point.traceId,
    };
  });
}

export function VerifiedMCSA({
  points,
  activePoint,
}: {
  points: AnalysisTelemetryPoint[];
  activePoint: AnalysisTelemetryPoint;
}) {
  const waveformPoints = points.filter((point) => Array.isArray(point.rawWaveform) && point.rawWaveform.length >= 2);
  if (!Array.isArray(activePoint.rawWaveform) || activePoint.rawWaveform.length < 2) return null;
  const spectrum = computeSpectrum(activePoint);
  const isSimulation = activePoint.isSimulation;

  return (
    <Card className="border-border bg-card shadow-lg">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Waves className="h-4 w-4 text-violet-300" />
              FFT / Harmonic Spectrum
            </CardTitle>
            <CardDescription className="mt-1">
              Computed only from the verified raw_waveform on the active telemetry point.
            </CardDescription>
          </div>
          {isSimulation && <SimulationBadge />}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-violet-400/40 text-violet-300">RAW WAVEFORM PRESENT</Badge>
          <span className="font-mono">Trace ID: {activePoint.traceId}</span>
        </div>
      </CardHeader>
      <CardContent className="h-[320px] pt-4">
        {spectrum.length === 0 ? (
          <UnavailableChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spectrum} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="frequencyHz" tickFormatter={(value) => `${Number(value).toFixed(0)} Hz`} stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={25} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const value = payload[0]?.payload;
                return (
                  <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-xl">
                    <p className="font-mono">{Number(value.frequencyHz).toFixed(2)} Hz</p>
                    <p className="mt-1 text-muted-foreground">Magnitude: {Number(value.magnitude).toFixed(4)}</p>
                    <p className="mt-2 font-mono text-[10px] text-primary">{value.timestamp}</p>
                    <p className="font-mono text-[10px] text-primary">Trace ID: {value.traceId}</p>
                  </div>
                );
              }} />
              <Line dataKey="magnitude" name="Verified spectrum magnitude" stroke={chartColors.waveform} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function AcousticTrend({ points, onSelectPoint }: ChartProps) {
  const hasDb = points.some((point) => hasNumber(point.db));
  const hasUnavailable = points.some((point) => !hasNumber(point.db));
  return (
    <ChartShell
      title="Vibration / Acoustic"
      description="Null means no measured dB value was supplied; the ML nominal baseline is never shown as a measurement."
      icon={<Radio className="h-4 w-4 text-sky-300" />}
      points={points}
      availability={hasDb}
      hasUnavailable={hasUnavailable}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...lineChartProps(points, onSelectPoint)}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={28} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit=" dB" />
          <Tooltip content={<AuditTooltip />} />
          <Line dataKey="db" name="Measured dB" unit=" dB" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} connectNulls={false} />
          {points.map((point) => {
            const value = safetyPoint(point, "db");
            return value === undefined ? null : <ReferenceDot key={`db-trigger-${point.traceId}`} x={point.timestamp} y={value} r={6} fill="hsl(var(--destructive))" stroke="none" />;
          })}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}