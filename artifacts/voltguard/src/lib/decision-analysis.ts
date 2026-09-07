import type { FaultLog, Motor } from "@workspace/api-client-react";

export type DecisionAnalysis = {
  faultLabel: string | null;
  description: string;
  possibleCauses: string[];
  riskIfIgnored: string[];
  recommendedActions: string[];
};

type AnalysisContent = Omit<DecisionAnalysis, "faultLabel">;

const ANALYSIS_BY_FAULT: Record<string, (motorName: string) => AnalysisContent> = {
  "High Vibration": (motorName) => ({
    description: `Vibration levels on ${motorName} exceed safe operating limits. Combined harmonic distortion and acoustic signatures indicate mechanical imbalance or severe misalignment.`,
    possibleCauses: ["Bearing wear", "Shaft misalignment", "Loose mounting bolts", "Mechanical imbalance"],
    riskIfIgnored: ["Accelerated bearing failure", "Structural fatigue", "Sudden catastrophic breakdown"],
    recommendedActions: ["Inspect and lubricate bearings", "Check alignment and mounting", "Monitor closely for next 24 h"],
  }),
  "High THD": (motorName) => ({
    description: `${motorName} shows extremely high Total Harmonic Distortion. The current waveform is severely distorted, indicating advanced electrical or winding fault.`,
    possibleCauses: ["Winding insulation degradation", "Rotor bar damage", "Power quality issues", "Drive fault"],
    riskIfIgnored: ["Progressive insulation failure", "Increased heat generation", "Winding burnout"],
    recommendedActions: ["Measure insulation resistance", "Inspect drive output waveform", "Schedule winding test"],
  }),
  "Bearing Wear": (motorName) => ({
    description: `MCSA analysis detected bearing wear signatures on ${motorName}. Current harmonic pattern matches known early-stage bearing fault frequencies.`,
    possibleCauses: ["Insufficient lubrication", "Contaminated lubricant", "End-of-life bearing"],
    riskIfIgnored: ["Progressive bearing damage", "Increased vibration", "Rotor contact and motor failure"],
    recommendedActions: ["Schedule bearing replacement", "Apply appropriate grease", "Perform vibration analysis"],
  }),
  "Phase Imbalance": (motorName) => ({
    description: `${motorName} is operating with significantly reduced supply current, indicating a dropped or severely imbalanced phase. Single-phasing is a critical electrical fault.`,
    possibleCauses: ["Open circuit in supply conductor", "Blown fuse on one phase", "Contactor contact failure", "Loose terminal connection"],
    riskIfIgnored: ["Severe winding overheating", "Rapid insulation burnout", "Complete motor failure within minutes"],
    recommendedActions: ["Immediately check all phase voltages and currents", "Inspect contactors and fuses", "Do not restart until fault is resolved"],
  }),
  Overcurrent: (motorName) => ({
    description: `${motorName} is drawing current well above its rated capacity. Sustained overcurrent causes thermal damage to windings and insulation.`,
    possibleCauses: ["Mechanical overload on driven equipment", "Rotor locked or jammed", "Incorrect motor sizing", "Drive malfunction"],
    riskIfIgnored: ["Thermal insulation breakdown", "Winding burnout", "Fire risk"],
    recommendedActions: ["Check driven load for blockage or overload", "Verify motor rating matches application", "Inspect drive current limits"],
  }),
  "Anomaly Detected": (motorName) => ({
    description: `${motorName} shows anomalous current signatures not matching the healthy baseline profile. The active Decision Engine result requires verification.`,
    possibleCauses: ["Electrical imbalance", "Mechanical looseness", "Load variation"],
    riskIfIgnored: ["Unpredictable failure", "Production downtime", "Safety hazard"],
    recommendedActions: ["Increase monitoring frequency", "Schedule inspection", "Review recent operational changes"],
  }),
};

function unavailableAnalysis(): DecisionAnalysis {
  return {
    faultLabel: null,
    description: "No active Decision Engine result is available for this incident.",
    possibleCauses: [],
    riskIfIgnored: [],
    recommendedActions: [],
  };
}

/**
 * The live motor decision is authoritative. Historical fault text is reused
 * only when its fault label exactly matches the active final decision.
 */
export function getDecisionAnalysis(
  motor: Motor | undefined,
  incident: FaultLog | undefined,
): DecisionAnalysis {
  const activeFault = motor?.decisionUpdatedAt
    ? motor.decisionOverrideFired
      ? motor.decisionFaultLabel
      : motor.decisionFaultLabel ?? motor.decisionOriginalMlClass
    : null;
  if (!activeFault || !motor) return unavailableAnalysis();

  if (incident?.faultType === activeFault) {
    return {
      faultLabel: activeFault,
      description: incident.description,
      possibleCauses: incident.possibleCauses ?? [],
      riskIfIgnored: incident.riskIfIgnored ?? [],
      recommendedActions: incident.recommendedActions ?? [],
    };
  }

  const contentFactory = ANALYSIS_BY_FAULT[activeFault];
  if (contentFactory) {
    return { faultLabel: activeFault, ...contentFactory(motor.name) };
  }

  return {
    faultLabel: activeFault,
    description: `${motor.name} has an active Decision Engine result of ${activeFault}. Further inspection is required before drawing a physical conclusion.`,
    possibleCauses: ["The active decision label is not a confirmed physical root cause."],
    riskIfIgnored: ["The active condition may worsen without verification."],
    recommendedActions: ["Review the active telemetry snapshot and schedule a qualified inspection."],
  };
}