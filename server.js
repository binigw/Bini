import express from "express";

const app = express();
const configuredPort = process.env.PORT?.trim() || "8080";
const port = Number(configuredPort);
const now = () => new Date().toISOString();
const numericId = (value) => Number.parseInt(String(value), 10);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${configuredPort}"`);
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: "2mb" }));

const motors = new Map();
const personnel = new Map();
const alerts = new Map();
const faults = new Map();
const telemetry = [];
let nextMotorId = 1;
let nextPersonnelId = 1;
let nextAlertId = 1;
let nextFaultId = 1;

function motorView(motor) {
  return {
    ...motor,
    decisionUpdatedAt: motor.decisionUpdatedAt ?? null,
  };
}

function createMotorRecord(input = {}) {
  const createdAt = now();
  const motor = {
    id: nextMotorId++,
    name: String(input.name ?? "").trim(),
    location: String(input.location ?? "").trim(),
    motorType: String(input.motorType ?? "Induction").trim(),
    status: input.status || "running",
    healthScore: numberOr(input.healthScore, 100),
    currentThd: numberOr(input.currentThd, 0),
    currentDb: numberOr(input.currentDb ?? input.db, 0),
    anomalyScore: numberOr(input.anomalyScore, 0),
    decisionAnomalyDetected: false,
    daysToFailure: null,
    decisionFaultLabel: null,
    decisionFaultConfidence: null,
    decisionMlActive: null,
    decisionEmergencyTrip: null,
    decisionOverrideFired: null,
    decisionOverrideReason: null,
    decisionIfAnomalyScore: null,
    decisionRfTopClass: null,
    decisionXgbTopClass: null,
    decisionModelsAgreed: null,
    decisionOriginalMlClass: null,
    decisionOriginalMlConf: null,
    decisionUpdatedAt: null,
    installedAt: input.installedAt || createdAt,
    lastServiceAt: input.lastServiceAt || null,
    createdAt,
  };
  motors.set(motor.id, motor);
  return motor;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function requireText(body, fields) {
  const missing = fields.filter((field) => !String(body?.[field] ?? "").trim());
  return missing.length ? `Missing required field(s): ${missing.join(", ")}` : null;
}

function getMotorOr404(req, res) {
  const id = numericId(req.params.id);
  const motor = motors.get(id);
  if (!Number.isInteger(id) || !motor) {
    res.status(404).json({ error: "Motor not found" });
    return null;
  }
  return motor;
}

function createAlert(motor, result) {
  const alert = {
    id: nextAlertId++,
    motorId: motor.id,
    motorName: motor.name,
    faultType: result.faultLabel,
    severity: result.severity,
    message: result.message,
    acknowledged: false,
    acknowledgedAt: null,
    createdAt: now(),
  };
  alerts.set(alert.id, alert);
  return alert;
}

function createFault(motor, result, input) {
  const fault = {
    id: nextFaultId++,
    motorId: motor.id,
    motorName: motor.name,
    faultType: result.faultLabel,
    severity: result.severity,
    description: result.message,
    possibleCauses: result.faultLabel === "Normal" ? [] : ["Abnormal telemetry detected"],
    riskIfIgnored: result.faultLabel === "Normal" ? [] : ["Continued operation may reduce motor health"],
    recommendedActions: result.faultLabel === "Normal" ? [] : ["Inspect the motor and collect another telemetry sample"],
    anomalyScore: result.anomalyScore,
    ifAnomalyScore: result.ifAnomalyScore,
    anomalyDetected: result.anomalyDetected,
    healthScore: result.healthScore,
    thdAtFault: numberOr(input.thd, 0),
    dbAtFault: numberOr(input.db, 0),
    resolved: false,
    resolvedAt: null,
    detectedAt: now(),
  };
  faults.set(fault.id, fault);
  return fault;
}

function processTelemetry(input = {}) {
  const motor = motors.get(numericId(input.motorId));
  if (!motor) return { error: "Motor not found" };

  const current = numberOr(input.current, 0);
  const thd = numberOr(input.thd, 0);
  const db = numberOr(input.db, 0);
  const anomalyScore = Math.max(0, Math.min(1, thd / 20 + Math.max(0, db - 70) / 100));
  const anomalyDetected = thd >= 8 || db >= 85 || current >= 100;
  const faultLabel = thd >= 8 ? "High THD" : db >= 85 ? "Vibration" : current >= 100 ? "Overcurrent" : "Normal";
  const severity = faultLabel === "Normal" ? "info" : anomalyDetected && (thd >= 12 || db >= 95 || current >= 125) ? "critical" : "warning";
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - anomalyScore * 100)));
  const timestamp = input.timestamp || now();
  const result = {
    motorId: motor.id,
    anomalyScore,
    ifAnomalyScore: anomalyScore,
    healthScore,
    anomalyDetected,
    nextLogIntervalSeconds: anomalyDetected ? 30 : 300,
    severity,
    emergencyTrip: severity === "critical",
    status: severity === "critical" ? "stopped" : anomalyDetected ? "warning" : "running",
    message: anomalyDetected ? `${faultLabel} detected for ${motor.name}` : "Telemetry is within normal range",
    faultLabel,
    faultConfidence: anomalyDetected ? Math.min(0.99, 0.7 + anomalyScore / 3) : 0.99,
    mlActive: false,
    overrideFired: false,
    overrideReason: "",
    rfTopClass: faultLabel,
    xgbTopClass: faultLabel,
    modelsAgreed: true,
    originalMlClass: faultLabel,
    originalMlConf: anomalyDetected ? 0.7 : 0.99,
  };

  const sample = {
    motorId: motor.id,
    motorName: motor.name,
    timestamp,
    current,
    thd,
    db,
    frequency: numberOr(input.frequency, 50),
    anomalyScore,
    ifAnomalyScore: anomalyScore,
    anomalyDetected,
    healthScore,
  };
  telemetry.push(sample);
  if (telemetry.length > 5000) telemetry.shift();

  Object.assign(motor, {
    status: result.status,
    healthScore,
    currentThd: thd,
    currentDb: db,
    anomalyScore,
    decisionAnomalyDetected: anomalyDetected,
    decisionFaultLabel: faultLabel,
    decisionFaultConfidence: result.faultConfidence,
    decisionMlActive: result.mlActive,
    decisionEmergencyTrip: result.emergencyTrip,
    decisionOverrideFired: result.overrideFired,
    decisionOverrideReason: result.overrideReason,
    decisionIfAnomalyScore: result.ifAnomalyScore,
    decisionRfTopClass: result.rfTopClass,
    decisionXgbTopClass: result.xgbTopClass,
    decisionModelsAgreed: result.modelsAgreed,
    decisionOriginalMlClass: result.originalMlClass,
    decisionOriginalMlConf: result.originalMlConf,
    decisionUpdatedAt: timestamp,
  });

  if (anomalyDetected) {
    createAlert(motor, result);
    createFault(motor, result, input);
  }
  return result;
}

function listFilteredAlerts(req) {
  return [...alerts.values()]
    .filter((alert) => !req.query.acknowledged || String(alert.acknowledged) === String(req.query.acknowledged))
    .filter((alert) => !req.query.severity || alert.severity === req.query.severity)
    .filter((alert) => !req.query.motorId || alert.motorId === numericId(req.query.motorId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

app.get("/", (_req, res) => {
  res.status(200).json({ service: "voltguard-api", status: "ok" });
});

app.get(["/health", "/api/healthz"], (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const listMotors = (_req, res) => {
  res.json([...motors.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(motorView));
};

const createMotor = (req, res) => {
  const error = requireText(req.body, ["name", "location", "motorType"]);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  res.status(201).json(motorView(createMotorRecord(req.body)));
};

const getMotor = (req, res) => {
  const motor = getMotorOr404(req, res);
  if (motor) res.json(motorView(motor));
};

const updateMotor = (req, res) => {
  const motor = getMotorOr404(req, res);
  if (!motor) return;
  const allowed = ["name", "location", "motorType", "status", "healthScore", "currentThd", "currentDb", "lastServiceAt"];
  for (const field of allowed) {
    if (req.body?.[field] !== undefined) motor[field] = req.body[field];
  }
  res.json(motorView(motor));
};

const deleteMotor = (req, res) => {
  const motor = getMotorOr404(req, res);
  if (!motor) return;
  motors.delete(motor.id);
  res.sendStatus(204);
};

app.get(["/api/motors", "/api/machines"], listMotors);
app.post(["/api/motors", "/api/machines"], createMotor);
app.get(["/api/motors/:id", "/api/machines/:id"], getMotor);
app.patch(["/api/motors/:id", "/api/machines/:id"], updateMotor);
app.delete(["/api/motors/:id", "/api/machines/:id"], deleteMotor);

app.get("/api/personnel", (_req, res) => {
  res.json([...personnel.values()]);
});

app.post("/api/personnel", (req, res) => {
  const error = requireText(req.body, ["name", "role", "teamName", "contact"]);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  const member = {
    id: nextPersonnelId++,
    name: String(req.body.name).trim(),
    role: String(req.body.role).trim(),
    teamName: String(req.body.teamName).trim(),
    contact: String(req.body.contact).trim(),
    telegramId: req.body.telegramId || null,
    telegramChatId: null,
    fcmToken: null,
    assignedMotorIds: Array.isArray(req.body.assignedMotorIds) ? req.body.assignedMotorIds.map(numericId) : [],
    createdAt: now(),
  };
  personnel.set(member.id, member);
  res.status(201).json(member);
});

app.patch("/api/personnel/:id", (req, res) => {
  const id = numericId(req.params.id);
  const member = personnel.get(id);
  if (!member) {
    res.status(404).json({ error: "Personnel member not found" });
    return;
  }
  Object.assign(member, req.body);
  res.json(member);
});

app.delete("/api/personnel/:id", (req, res) => {
  const id = numericId(req.params.id);
  if (!personnel.delete(id)) {
    res.status(404).json({ error: "Personnel member not found" });
    return;
  }
  res.sendStatus(204);
});

app.get("/api/alerts/live", (_req, res) => {
  res.json(listFilteredAlerts({ query: { acknowledged: "false" } }));
});

app.get("/api/alerts", (req, res) => {
  res.json(listFilteredAlerts(req));
});

app.post("/api/alerts/:id/acknowledge", (req, res) => {
  const alert = alerts.get(numericId(req.params.id));
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  alert.acknowledged = true;
  alert.acknowledgedAt = now();
  res.json(alert);
});

app.delete("/api/alerts/:id", (req, res) => {
  if (!alerts.delete(numericId(req.params.id))) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.sendStatus(204);
});

app.get("/api/faults", (_req, res) => {
  res.json([...faults.values()].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)));
});

app.get("/api/faults/:id", (req, res) => {
  const fault = faults.get(numericId(req.params.id));
  if (!fault) {
    res.status(404).json({ error: "Fault not found" });
    return;
  }
  res.json(fault);
});

app.delete("/api/faults/:id", (req, res) => {
  if (!faults.delete(numericId(req.params.id))) {
    res.status(404).json({ error: "Fault not found" });
    return;
  }
  res.sendStatus(204);
});

app.post("/api/faults/:id/analyze", (req, res) => {
  const fault = faults.get(numericId(req.params.id));
  if (!fault) {
    res.status(404).json({ error: "Fault not found" });
    return;
  }
  res.json({
    ...fault,
    analysis: {
      summary: `${fault.faultType} was recorded for ${fault.motorName}.`,
      confidence: fault.anomalyDetected ? 0.8 : 0.99,
      recommendedActions: fault.recommendedActions,
    },
  });
});

function telemetryInput(req, res) {
  const result = processTelemetry(req.body);
  if (result.error) {
    res.status(404).json({ error: result.error });
    return null;
  }
  return result;
}

app.post(["/api/telemetry", "/api/telemetry/update"], (req, res) => {
  const result = telemetryInput(req, res);
  if (result) res.json(result);
});

app.post("/api/telemetry/live-ingest", (req, res) => {
  const result = telemetryInput(req, res);
  if (result) {
    res.status(201).json({
      accepted: true,
      motorId: result.motorId,
      anomalyScore: result.anomalyScore,
      faultLabel: result.faultLabel,
      relayTripped: result.emergencyTrip,
    });
  }
});

app.get("/api/telemetry/history", (req, res) => {
  const motorId = req.query.motorId ? numericId(req.query.motorId) : null;
  const hours = numberOr(req.query.hours, 72);
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const result = telemetry.filter((sample) => {
    const matchesMotor = motorId === null || sample.motorId === motorId;
    return matchesMotor && new Date(sample.timestamp).getTime() >= cutoff;
  });
  res.json(result);
});

app.post("/api/telemetry/explain", (req, res) => {
  const body = req.body || {};
  res.json({
    fault: body.faultLabel || body.fault || "Normal",
    explanation: "The explanation is based on the latest telemetry values supplied by the client.",
    recommendations: ["Continue monitoring the motor", "Collect another telemetry sample if conditions change"],
  });
});

app.post("/api/explain-fault", (req, res) => {
  const body = req.body || {};
  res.json({
    fault: body.faultLabel || body.fault || "Normal",
    explanation: "The explanation is based on the verified telemetry snapshot supplied by the client.",
    recommendations: ["Continue monitoring the motor", "Collect another telemetry sample if conditions change"],
    explanationSource: "rule-based-fallback",
  });
});

app.get("/api/system/summary", (_req, res) => {
  const motorList = [...motors.values()];
  const activeAlerts = [...alerts.values()].filter((alert) => !alert.acknowledged);
  const averageHealthScore = motorList.length
    ? motorList.reduce((sum, motor) => sum + numberOr(motor.healthScore, 0), 0) / motorList.length
    : 0;
  res.json({
    totalMotors: motorList.length,
    runningCount: motorList.filter((motor) => motor.status === "running").length,
    warningCount: motorList.filter((motor) => motor.status === "warning").length,
    stoppedCount: motorList.filter((motor) => motor.status === "stopped").length,
    averageHealthScore: Math.round(averageHealthScore),
    activeAlertCount: activeAlerts.length,
    highPriorityAlerts: activeAlerts.filter((alert) => alert.severity === "critical").length,
    mediumPriorityAlerts: activeAlerts.filter((alert) => alert.severity === "warning").length,
    predictiveRisk: activeAlerts.length ? "elevated" : "low",
    predictiveRiskDetail: activeAlerts.length ? "Active alerts require review." : "No active alerts.",
    healthTrend: null,
  });
});

app.get("/api/analytics/trends", (req, res) => {
  const motorId = req.query.motorId ? numericId(req.query.motorId) : null;
  res.json(telemetry.filter((sample) => motorId === null || sample.motorId === motorId));
});

app.get("/api/notifications/status", (_req, res) => {
  res.json({
    telegram: { configured: false, connected: false },
    firebase: { configured: false, connected: false },
    registeredTokens: 0,
  });
});

app.post("/api/notifications/register-token", (req, res) => {
  res.status(201).json({ success: true, personnelId: req.body?.personnelId ?? null });
});

app.delete("/api/notifications/register-token/:personnelId", (req, res) => {
  res.json({ success: true, personnelId: numericId(req.params.personnelId) });
});

app.post("/api/notifications/test-alert", (_req, res) => {
  res.json({
    success: false,
    message: "Notifications are not configured on this backend.",
    telegram: { sent: false },
    fcm: { sent: false },
  });
});

app.get("/api/training-data/stats", (_req, res) => {
  const faultSamples = telemetry.filter((sample) => sample.anomalyDetected).length;
  res.json({
    totalSamples: telemetry.length,
    healthySamples: telemetry.length - faultSamples,
    faultSamples,
    healthyVsFaultRatio: telemetry.length ? (telemetry.length - faultSamples) / telemetry.length : 0,
    labelDistribution: {},
    severityDistribution: {},
    relayTripCount: 0,
    motorCoverage: { represented: new Set(telemetry.map((sample) => sample.motorId)).size, total: motors.size },
    motorBreakdown: [],
    classCoverage: [],
    classesReadyCount: 0,
    totalExpectedClasses: 6,
    minSamplesPerClass: 100,
    isReadyForTraining: false,
  });
});

app.get("/api/training-data/export.csv", (_req, res) => {
  const header = "timestamp,motorId,motorName,current,thd,db,anomalyScore,healthScore,anomalyDetected";
  const rows = telemetry.map((sample) =>
    [sample.timestamp, sample.motorId, sample.motorName, sample.current, sample.thd, sample.db, sample.anomalyScore, sample.healthScore, sample.anomalyDetected].join(","),
  );
  res.type("text/csv").send([header, ...rows].join("\n"));
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close((error) => {
    if (error) {
      console.error("Server shutdown failed", error);
      process.exitCode = 1;
      return;
    }
    process.exit(0);
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
