import { useState, useMemo } from "react";
import { useListMotors, useGetAnalyticsTrends, getListMotorsQueryKey, getGetAnalyticsTrendsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart } from "recharts";
import { Activity, Zap, Volume2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ApiErrorState } from "@/components/api-error-state";

export function Analytics() {
  const [selectedMotorId, setSelectedMotorId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("24");

  const { data: motors, isLoading: isMotorsLoading, isError: isMotorsError } = useListMotors({
    query: { refetchInterval: 30000, queryKey: getListMotorsQueryKey() },
  });
  
  // Convert selectedMotorId to number or undefined
  const motorIdParam = selectedMotorId !== "all" ? parseInt(selectedMotorId, 10) : undefined;
  
  // Analytics trends params
  const trendParams = useMemo(() => ({
    motorId: motorIdParam,
    hours: parseInt(timeRange, 10)
  }), [motorIdParam, timeRange]);

  const { data: trends, isLoading: isTrendsLoading, isError: isTrendsError } = useGetAnalyticsTrends(trendParams, {
    query: { refetchInterval: 30000, queryKey: getGetAnalyticsTrendsQueryKey(trendParams) }
  });

  const motorRecords = Array.isArray(motors)
    ? motors.filter((motor) => Boolean(motor) && typeof motor === "object" && typeof motor.id === "number")
    : [];
  const trendRecords = Array.isArray(trends)
    ? trends.filter((point) => Boolean(point) && typeof point === "object")
    : [];
  const isLoading = isMotorsLoading || isTrendsLoading;

  // Format the data for recharts
  const chartData = useMemo(() => {
    return trendRecords.map(pt => ({
      ...pt,
      formattedTime: formatAnalyticsTime(pt.timestamp),
       anomalyPercentage: pt.ifAnomalyScore == null ? null : pt.ifAnomalyScore * 100
    }));
  }, [trendRecords]);

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Telemetry Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Deep dive into motor health trends, harmonics, and anomaly detection.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card p-2 rounded-lg border border-border">
          <Select value={selectedMotorId} onValueChange={setSelectedMotorId}>
            <SelectTrigger className="w-[180px] bg-background border-border">
              <SelectValue placeholder="Select Motor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Motors (Avg)</SelectItem>
              {motorRecords.map(m => (
                <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] bg-background border-border">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">Last 6 Hours</SelectItem>
              <SelectItem value="12">Last 12 Hours</SelectItem>
              <SelectItem value="24">Last 24 Hours</SelectItem>
              <SelectItem value="72">Last 3 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Health Trend */}
        <Card className="col-span-1 lg:col-span-2 border-border bg-card shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> 
              Health Score & Anomaly Correlation
            </CardTitle>
            <CardDescription>
              Predictive health score versus the Isolation Forest anomaly gate. Higher IF scores precede health drops.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 h-[350px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : isMotorsError || isTrendsError ? (
              <ApiErrorState message="Unable to load telemetry analytics." />
            ) : chartData.length === 0 ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAnomaly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="hsl(var(--muted-foreground))" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} />
                  
                  <Area yAxisId="left" type="monotone" dataKey="healthScore" name="Health Score" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorHealth)" />
                   <Line yAxisId="right" type="monotone" dataKey="anomalyPercentage" name="Isolation Forest score" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* THD Chart */}
        <Card className="col-span-1 border-border bg-card shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[hsl(var(--chart-2))]" /> 
              Current THD (Harmonics)
            </CardTitle>
            <CardDescription>Total Harmonic Distortion percentage over time.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 h-[300px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : isMotorsError || isTrendsError ? (
              <ApiErrorState message="Unable to load telemetry analytics." />
            ) : chartData.length === 0 ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="hsl(var(--muted-foreground))" fontSize={12} minTickGap={30} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(val) => `${val}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="thd" name="THD %" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* dB Chart */}
        <Card className="col-span-1 border-border bg-card shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-[hsl(var(--chart-4))]" /> 
              Vibration / Acoustic (dB)
            </CardTitle>
            <CardDescription>Acoustic signature and vibration intensity.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 h-[300px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : isMotorsError || isTrendsError ? (
              <ApiErrorState message="Unable to load telemetry analytics." />
            ) : chartData.length === 0 ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="formattedTime" stroke="hsl(var(--muted-foreground))" fontSize={12} minTickGap={30} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(val) => `${val} dB`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="db" name="Acoustic (dB)" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-black/20">
      <Activity className="h-8 w-8 mb-2 opacity-20" />
      <p className="text-sm">No telemetry data available for this selection.</p>
    </div>
  );
}

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
            </div>
            <span className="font-mono text-foreground font-medium">
              {entry.name.includes('%') || entry.name.includes('Health') || entry.name.includes('Prob') 
                ? `${Number(entry.value).toFixed(1)}%` 
                : `${Number(entry.value).toFixed(1)} dB`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function formatAnalyticsTime(value: string | undefined): string {
  const date = value ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime()) ? format(date, "HH:mm") : "—";
}
