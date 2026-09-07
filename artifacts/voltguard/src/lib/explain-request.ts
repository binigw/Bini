import type { AnalysisTelemetryPoint, TelemetryExplainResponse } from "@workspace/api-client-react";
import { apiFetch } from "./api-url";

export function hasCompleteExplanationEvidence(point: AnalysisTelemetryPoint | undefined) {
  return Boolean(
    point &&
      point.traceId &&
      point.timestamp &&
      point.faultLabel &&
      typeof point.faultConfidence === "number" &&
      point.severity &&
      point.status &&
      typeof point.current === "number" &&
      typeof point.thd === "number" &&
      typeof point.db === "number" &&
      typeof point.emergencyTrip === "boolean" &&
      typeof point.overrideFault === "boolean" &&
      typeof point.overrideReason === "string" &&
      point.rfTopClass &&
      point.xgbTopClass &&
      typeof point.modelsAgreed === "boolean",
  );
}

export function snapshotForExplain(point: AnalysisTelemetryPoint) {
  return {
    motorId: point.motorId,
    timestamp: point.timestamp,
    traceId: point.traceId,
    faultLabel: point.faultLabel,
    faultConfidence: point.faultConfidence,
    ifAnomalyScore: point.ifAnomalyScore,
    severity: point.severity,
    status: point.status,
    emergencyTrip: point.emergencyTrip,
    overrideFired: point.overrideFault,
    overrideReason: point.overrideReason,
    rfTopClass: point.rfTopClass,
    xgbTopClass: point.xgbTopClass,
    modelsAgreed: point.modelsAgreed,
    current: point.current,
    thd: point.thd,
    db: point.db,
    frequency: point.frequency,
    phase_currents_a: point.phaseCurrentsA ?? undefined,
    phase_voltages_v: point.phaseVoltagesV ?? undefined,
    telemetry_source: point.telemetrySource,
  };
}

export async function requestTelemetryExplanation(
  point: AnalysisTelemetryPoint,
  snapshotWindow: AnalysisTelemetryPoint[],
): Promise<TelemetryExplainResponse> {
  const response = await apiFetch("/api/telemetry/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      snapshot: snapshotForExplain(point),
      snapshotWindow,
    }),
  });
  const payload = await response.json() as TelemetryExplainResponse & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Explanation request failed (${response.status})`);
  }
  return payload;
}
