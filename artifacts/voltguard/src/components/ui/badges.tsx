import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

export function MotorStatusBadge({ status }: { status: 'running' | 'warning' | 'stopped' }) {
  const { t } = useI18n();
  switch (status) {
    case 'running':
      return <Badge className="bg-primary hover:bg-primary/80 text-primary-foreground border-transparent font-semibold shadow-[0_0_10px_rgba(26,214,104,0.3)]">{t("status.running")}</Badge>;
    case 'warning':
      return <Badge className="bg-[hsl(var(--chart-2))] hover:bg-[hsl(var(--chart-2))]/80 text-black border-transparent font-semibold">{t("status.warning")}</Badge>;
    case 'stopped':
      return <Badge variant="destructive" className="font-semibold shadow-[0_0_10px_rgba(255,42,42,0.3)]">{t("status.stopped")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' | 'low' | string }) {
  const { t } = useI18n();
  switch (severity.toLowerCase()) {
    case 'critical':
      return <Badge variant="destructive" className="animate-pulse shadow-[0_0_10px_rgba(255,42,42,0.5)]">{t("severity.critical")}</Badge>;
    case 'high':
      return <Badge variant="destructive">{t("severity.high")}</Badge>;
    case 'medium':
      return <Badge className="bg-[hsl(var(--chart-2))] hover:bg-[hsl(var(--chart-2))]/80 text-black">{t("severity.medium")}</Badge>;
    case 'low':
      return <Badge className="bg-muted text-muted-foreground border-border">{t("severity.low")}</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}

export function HealthScoreBadge({ score }: { score: number }) {
  let colorClass = "text-primary";
  if (score < 50) colorClass = "text-destructive";
  else if (score < 80) colorClass = "text-[hsl(var(--chart-2))]";

  return <span className={`font-bold ${colorClass}`}>{score}%</span>;
}
