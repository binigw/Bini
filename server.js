import express from "express";

const app = express();
const configuredPort = process.env.PORT?.trim() || "8080";
const port = Number(configuredPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${configuredPort}"`);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({ service: "simple-backend", status: "ok" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
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
