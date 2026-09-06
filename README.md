# VoltGuard frontend and API

## Netlify deployment

The dashboard is a plain JavaScript Vite application. Netlify should deploy the
static frontend using the settings in `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`

The SPA fallback in `netlify.toml` keeps direct navigation and browser refreshes
working for frontend routes such as `/machines`, `/alerts`, and `/analytics`.

`server.js` is a separate long-running Express API. Netlify does not run that
process as a persistent server, so deploy the API separately on a server host
or refactor its routes into Netlify Functions before attempting to host the
backend on Netlify. Set `VITE_API_URL` in Netlify's environment variables to
the deployed API URL.

The current API uses in-memory storage; data is lost when the API process
restarts.

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
