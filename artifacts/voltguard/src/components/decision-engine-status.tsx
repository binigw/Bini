import type { Motor } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { Activity, BrainCircuit, Cpu, GitBranch, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";

interface DecisionEngineStatusProps {
  motor?: Motor;
  className?: string;
}

export function latestDecisionMotor(motors?: Motor[]): Motor | undefined {
  return [...(motors ?? [])]
    .filter((motor) => motor.decisionUpdatedAt)
    .sort((a, b) => {
      return new Date(b.decisionUpdatedAt!).getTime() - new Date(a.decisionUpdatedAt!).getTime();
    })[0];
}

export function DecisionEngineStatus({ motor, className }: DecisionEngineStatusProps) {
  const { t, fault } = useI18n();
  const activeDecision = fault(motor?.decisionFaultLabel) ?? t("dashboard.noDecision");
  const decisionSuffix = motor?.decisionOverrideFired ? ` · ${t("dashboard.safetyOverride")}` : "";

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BrainCircuit className="h-5 w-5 text-primary" />
          <span>{t("dashboard.decisionEngine")}: {activeDecision}{decisionSuffix}</span>
          {motor && (
            <Badge variant="outline" className="ml-auto font-mono text-xs">
              {motor.name}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!motor || !motor.decisionUpdatedAt ? (
          <div className="flex min-h-16 items-center gap-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 shrink-0" />
            {t("dashboard.noDecisionResult")}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatusMetric label={t("dashboard.fault")} value={fault(motor.decisionFaultLabel) ?? "—"} />
              <StatusMetric
                label={t("dashboard.faultConfidence")}
                value={motor.decisionFaultConfidence == null ? "—" : `${(motor.decisionFaultConfidence * 100).toFixed(1)}%`}
              />
              <StatusMetric
                label={t("dashboard.modelStatus")}
                value={motor.decisionMlActive ? t("dashboard.mlActive") : t("dashboard.ruleFallback")}
                tone={motor.decisionMlActive ? "primary" : "warning"}
              />
              <StatusMetric
                label={t("dashboard.relay")}
                value={motor.decisionEmergencyTrip ? t("dashboard.tripped") : t("dashboard.normal")}
                tone={motor.decisionEmergencyTrip ? "danger" : "primary"}
              />
              <StatusMetric
                label={t("dashboard.override")}
                value={motor.decisionOverrideFired ? t("dashboard.fired") : t("dashboard.none")}
                tone={motor.decisionOverrideFired ? "warning" : "muted"}
              />
            </div>

            <div className="grid gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground md:grid-cols-2">
              <div className="flex items-start gap-2">
                <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="font-semibold text-foreground">{t("dashboard.models")}:</span>{" "}
                  XGBoost {motor.decisionXgbTopClass ?? "—"} · RF {motor.decisionRfTopClass ?? "—"} ·
                  {" "}IF {motor.decisionIfAnomalyScore == null ? "—" : motor.decisionIfAnomalyScore.toFixed(3)}
                </span>
              </div>
              <div className="flex items-start gap-2">
                {motor.decisionEmergencyTrip ? (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                )}
                <span>
                  <span className="font-semibold text-foreground">{t("dashboard.decision")}:</span>{" "}
                  {motor.decisionOverrideFired
                     ? motor.decisionOverrideReason || t("dashboard.failSafeOverride")
                    : motor.decisionModelsAgreed == null
                       ? t("dashboard.agreementUnavailable")
                      : motor.decisionModelsAgreed
                         ? t("dashboard.modelsAgreed")
                         : t("dashboard.modelsDisagreed")}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <GitBranch className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{t("dashboard.originalMl")}:</span>{" "}
                  {motor.decisionOriginalMlClass ?? "—"}{" "}
                  {motor.decisionOriginalMlConf == null ? "" : `(${(motor.decisionOriginalMlConf * 100).toFixed(1)}%)`}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Activity className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                   {t("dashboard.updatedAgo")} {formatDistanceToNow(new Date(motor.decisionUpdatedAt!), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusMetric({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "primary" | "warning" | "danger" | "muted";
}) {
  const toneClass = {
    primary: "text-primary",
    warning: "text-[hsl(var(--chart-2))]",
    danger: "text-destructive",
    muted: "text-foreground",
  }[tone];

  return (
    <div className="rounded-md border border-border/60 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}