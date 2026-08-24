# mini-RAG interface

A Gemini-style web interface for the RAG backend: pick a workspace, upload documents,
ask questions, read a streamed answer with its sources.

## Running

```bash
npm install
cp .env.example .env   # first time only
npm run dev            # http://localhost:5173
npm test               # unit + smoke tests
npm run build          # production bundle into dist/
```

## Configuration

All settings live in `.env` and are read by `vite.config.js` via `loadEnv`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://127.0.0.1:8000` | Backend the dev server proxies `/api` to |
| `VITE_PORT` | `5173` | Port for the dev server itself |
| `VITE_USE_MOCKS` | `true` | Run against the in-memory double instead of the backend |

Because `/api` is proxied, the browser stays same-origin and the backend needs no
CORS configuration in development.

Use `127.0.0.1` rather than `localhost` in `VITE_API_URL`. Node resolves `localhost`
to `::1` (IPv6) first, while uvicorn binds IPv4 only by default, so `localhost` makes
the proxy fail with `ECONNREFUSED ::1:8000`.

The proxy only exists in the dev server. A production build serves `/api` from
whatever origin hosts `dist/`.

## Mock mode

`VITE_USE_MOCKS=false` (the default) talks to the real FastAPI backend. Setting it
to `true` swaps in an in-memory double (`src/api/mockApi.js`) that speaks the same
contracts, which is useful for working on the UI with no backend running. A
`mock data` badge appears in the top bar whenever mocks are active.

The endpoints the UI depends on:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/data/projects` | workspace rail |
| `POST /api/v1/data/projects` | create a workspace |
| `GET /api/v1/data/files/{project_id}` | file tray |
| `POST /api/v1/data/ingest/{project_id}` | upload + chunk + embed in one call |
| `POST /api/v1/nlp/answer/{project_id}` | streamed answer (SSE) |

## Streaming protocol

`POST /api/v1/nlp/answer/{project_id}` is expected to return `text/event-stream` with
JSON payloads:

```
data: {"type":"sources","value":[{"text":"…","score":0.82,"file":"report.pdf"}]}
data: {"type":"token","value":"The "}
data: {"type":"done"}
data: {"type":"error","message":"…"}
```

Request body: `{ "text": "…", "history": [{"role":"user","text":"…"}], "limit": 5 }`.

## Layout

```
src/
  api/        client.js (REST) · answerStream.js (SSE) · sse.js (decoder) · mockApi.js
  chat/       chatReducer.js (pure state machine) · useChat.js
  files/      useFiles.js (upload lifecycle)
  components/ Sidebar · ChatThread · Message · Sources · Composer · FileTray · EmptyState
  styles/     app.css (light + dark via prefers-color-scheme)
```
