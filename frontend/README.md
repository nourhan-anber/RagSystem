# mini-RAG interface

A Gemini-style web interface for the RAG backend: pick a workspace, upload documents,
ask questions, read a streamed answer with its sources.

## Running

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + smoke tests
npm run build      # production bundle into dist/
```

`/api` is proxied to `http://localhost:8000`, so the backend needs no CORS config
in development.

## Mock mode

The endpoints this UI calls do not exist in the backend yet:

| Needed by the UI | Status |
| --- | --- |
| `GET /api/v1/data/projects` | not built |
| `POST /api/v1/data/projects` | not built |
| `GET /api/v1/data/files/{project_id}` | not built |
| `POST /api/v1/data/ingest/{project_id}` | not built |
| `POST /api/v1/nlp/answer/{project_id}` (SSE) | not built |

Until they exist, `.env` sets `VITE_USE_MOCKS=true` and the interface runs against an
in-memory double (`src/api/mockApi.js`) that speaks the same contracts. A `mock data`
badge appears in the top bar so this is never mistaken for real output.

Set `VITE_USE_MOCKS=false` once the backend endpoints land. No other change is needed —
`src/api/index.js` is the only place the choice is made.

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
