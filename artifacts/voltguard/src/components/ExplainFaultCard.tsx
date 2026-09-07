import { useState } from "react";
import type { AnalysisTelemetryPoint, TelemetryExplainResponse } from "@workspace/api-client-react";
import { AlertTriangle, BrainCircuit, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { hasCompleteExplanationEvidence, requestTelemetryExplanation } from "@/lib/explain-request";

type ExplainResponse = TelemetryExplainResponse & {
  possible_causes: Array<{ en: string; am: string }>;
  recommended_checks: Array<{ en: string; am: string }>;
  limitations: { en: string; am: string };
  confidence_assessment: { score: number; level: string; reason_en: string; reason_am: string };
};

export function ExplainFaultCard({
  activePoint,
  snapshotWindow,
  snapshotLoading = false,
  snapshotError,
  titleKey = "explain.title",
  descriptionKey = "explain.description",
}: {
  activePoint?: AnalysisTelemetryPoint;
  snapshotWindow: AnalysisTelemetryPoint[];
  snapshotLoading?: boolean;
  snapshotError?: string;
  titleKey?: "explain.title" | "dashboard.explainFault";
  descriptionKey?: "explain.description" | "dashboard.explainDescription";
}) {
  const { language, t, localize, fault } = useI18n();
  const [explanation, setExplanation] = useState<ExplainResponse>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const canExplain = hasCompleteExplanationEvidence(activePoint);

  const handleExplain = async () => {
    if (!activePoint || !canExplain) return;
    setError(undefined);
    setExplanation(undefined);
    setIsLoading(true);
    try {
      const result = await requestTelemetryExplanation(activePoint, snapshotWindow);
      setExplanation(result as ExplainResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("explain.requestFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const listItems = (list: Array<{ en: string; am: string }> | undefined) =>
    (list ?? []).map((item) => language === "am" ? item.am : item.en);

  return (
    <Card className="border-primary/20 bg-card shadow-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainCircuit className="h-4 w-4 text-primary" />
            {t(titleKey)}
          </CardTitle>
          <CardDescription className="mt-1">{t(descriptionKey)}</CardDescription>
        </div>
        <Button onClick={handleExplain} disabled={!canExplain || isLoading}>
          {isLoading
            ? t("explain.explaining")
            : explanation
              ? t("explain.reAnalyze")
              : t("explain.explain")}
        </Button>
      </CardHeader>
      <CardContent>
        {!canExplain && (
          <p className="mb-3 text-xs text-amber-200">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {t("explain.notAvailable")}
          </p>
        )}
        {snapshotLoading && (
          <p className="mb-3 text-sm text-muted-foreground">{t("explain.loadingEvidence")}</p>
        )}
        {snapshotError && (
          <p className="mb-3 text-sm text-destructive">{snapshotError}</p>
        )}
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {explanation && (
          <div className="space-y-4">
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{fault(explanation.fault)}</p>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {explanation.explanationSource === "fallback" ? t("explain.verifiedFallback") : t("explain.deepSeek")}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-foreground/85">{localize(explanation.summary)}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ExplanationList
                title={t("explain.evidence")}
                items={explanation.evidence.map((item) => `${item.name}: ${localize(item.explanation)}`)}
              />
              <ExplanationList title={t("explain.possibleCauses")} items={listItems(explanation.possible_causes)} />
              <ExplanationList title={t("explain.recommendedChecks")} items={listItems(explanation.recommended_checks)} />
              <ExplanationList
                title={t("explain.limitations")}
                items={[localize(explanation.limitations)]}
              />
            </div>
            <div className="rounded-md border border-border/60 bg-black/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {t("explain.confidence")}: {language === "am"
                  ? explanation.confidence_assessment.reason_am
                  : explanation.confidence_assessment.reason_en}
              </div>
            </div>
            {explanation.audit && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{t("explain.auditTrace")}: <span className="font-mono text-primary">{explanation.audit.traceId}</span></span>
                <span>·</span>
                <span>{explanation.audit.pointCount} {t("explain.points")}</span>
                <span>·</span>
                <span>{explanation.audit.windowStart} → {explanation.audit.windowEnd}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExplanationList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-border/60 bg-black/10 p-3">
      <p className="mb-2 font-semibold text-primary">{title}</p>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="text-sm text-muted-foreground">
              <span className="mr-2 text-primary">•</span>{item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}
