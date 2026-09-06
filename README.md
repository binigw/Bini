# VoltGuard API Backend

A small Node.js/Express API for the VoltGuard Vercel dashboard. It supports motor
registration and CRUD, telemetry ingestion, alerts, fault logs, personnel, system
summary, analytics, and notification status routes.

## Run locally

```bash
npm install
npm start
```

The server binds to `0.0.0.0` and uses port `8080` by default. Set `PORT` to override it.

## Health check

```bash
curl http://127.0.0.1:8080/health
```

Expected response:

```json
{"status":"ok"}
```

## Motor registration

The dashboard uses the `/api/motors` routes. `/api/machines` is also supported as
a compatibility alias.

```bash
curl -X POST http://127.0.0.1:8080/api/motors \
  -H 'Content-Type: application/json' \
  -d '{"name":"Pump Motor 1","location":"Plant A","motorType":"Induction","status":"running"}'
```

The API is currently backed by in-memory storage so it can run without a database.
Data remains available while the server process is running; persistent production
storage should be added before relying on it for long-term records.
