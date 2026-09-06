# Simple Backend

A minimal Node.js/Express server for reliable health checks and deployment probes.

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
