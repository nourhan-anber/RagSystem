# RagSystem

Ask questions about your own documents. Upload a `.txt` or `.pdf`, and the system
chunks it, embeds it into a vector store, retrieves the passages relevant to your
question, and streams back an answer grounded strictly in those passages.

```
frontend/        React + Vite UI (workspaces, upload, streamed chat)
src/             FastAPI backend (ingestion, retrieval, generation)
docker/          MongoDB via Docker Compose
test-documents/  Sample documents and verification questions
```

Retrieval uses Qdrant in embedded mode — a local directory under
`src/assets/database/`, so there is no vector database server to run. MongoDB
stores projects, assets and chunks, and does need to be running.

## Prerequisites

There are two ways to run this. With Docker you need almost nothing installed;
locally you get hot reload while working on the code.

| | Version | Docker | Local |
| --- | --- | :---: | :---: |
| Docker | Compose v2 | required | MongoDB only |
| Cohere API key | — | required | required |
| Python | 3.10 | — | required |
| Node.js | 18+ | — | required |

An OpenAI key is optional: the code supports it as a generation backend, but the
default configuration uses Cohere for both embeddings and generation.

Node 18 is what this project is built against. Tailwind is pinned to v3 because
v4 requires Node 20 or newer.

## Run everything with Docker

The fastest path: MongoDB, the backend and the UI all start together.

```bash
cd docker
cp .env.example .env      # set MONGO_INITDB_ROOT_USERNAME / PASSWORD
cp ../src/.env.example ../src/.env
```

Put your key in `src/.env`:

```
COHERE_API_KEY="..."
```

`MONGODB_URL` in that file is ignored when running under Docker — Compose
overrides it so the backend reaches MongoDB by service name. Everything else in
the file (keys, models, chunking) is used as-is.

```bash
docker compose up -d --build
```

| Service | URL | Notes |
| --- | --- | --- |
| UI | <http://localhost:8080> | nginx serving the built app |
| API | <http://localhost:8000> | docs at `/docs` |
| MongoDB | `localhost:27007` | for host tools such as Compass |

The UI calls the API through nginx on the same origin, so no CORS setup is
needed and only port 8080 has to be reachable for normal use.

```bash
docker compose logs -f backend    # follow the API
docker compose ps                 # what is running
docker compose down               # stop, keeping data
docker compose down -v            # stop and delete documents and database
```

Rebuild after changing application code — the images copy the source in rather
than mounting it:

```bash
docker compose up -d --build
```

### What is where

| | |
| --- | --- |
| `src/Dockerfile` | Python 3.10, runs uvicorn on port 8000 |
| `frontend/Dockerfile` | builds with Node 18, serves the result from nginx |
| `frontend/nginx.conf` | SPA routing plus the `/api` proxy to the backend |
| `docker/docker-compose.yml` | the three services, network and volumes |

Uploaded documents and the embedded Qdrant store live in the `backend-assets`
volume, and MongoDB in `mongodata`. Both survive `down` and rebuilds; only
`down -v` removes them. The Docker stack keeps its own data, separate from
anything created by a local (non-Docker) run.

## Local setup (without Docker)

Useful when you want hot reload while working on the code.

## 1. Start MongoDB

```bash
cd docker
cp .env.example .env
```

Set credentials in `docker/.env`:

```
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=admin
```

These **must match** the credentials in `MONGODB_URL` in `src/.env` (next step),
or the backend starts and then fails on the first request.

```bash
docker compose up -d
```

MongoDB is published on host port **27007** (container 27017).

## 2. Backend

```bash
conda create -n mini-rag-app python=3.10
conda activate mini-rag-app

cd src
pip install -r requirements.txt
pip install -r requirements-dev.txt   # test tooling, optional
cp .env.example .env
```

Set your key in `src/.env`:

```
COHERE_API_KEY="..."
```

Run it:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Use **port 8000**. The frontend proxies `/api` there by default; on another port
the UI will load but every request fails.

Interactive API docs: <http://127.0.0.1:8000/docs>

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>.

`/api` is proxied to the backend, so the browser stays same-origin and the
backend needs no CORS configuration.

## Using it

1. Create a workspace in the left rail. Each workspace is an isolated document
   set with its own vector collection.
2. Upload a `.txt` or `.pdf`. Upload, chunking and embedding happen in one
   request; the file chip shows `Indexing…` until it is answerable.
3. Ask a question. The question field only appears once a document is indexed,
   since there would be nothing to answer from before that.

Sample documents and a list of verification questions with expected answers are
in [`test-documents/`](test-documents/).

## Configuration

Backend settings live in `src/.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `GENERATION_BACKEND` | `COHERE` | `COHERE` or `OPENAI` |
| `EMBEDDING_BACKEND` | `COHERE` | provider used to embed chunks and queries |
| `GENERATION_MODEL_ID` | `command-a-03-2025` | chat model |
| `EMBEDDING_MODEL_ID` | `embed-multilingual-light-v3.0` | must match `EMBEDDING_MODEL_SIZE` |
| `EMBEDDING_MODEL_SIZE` | `384` | vector dimension of the collection |
| `GENERATION_DAFAULT_MAX_TOKENS` | `200` | raise this if answers are cut short |
| `FILE_MAX_SIZE` | `10` | upload limit in MB |
| `PRIMARY_LANG` | `en` | prompt locale; `en` and `ar` are provided |

Changing `EMBEDDING_MODEL_ID` or `EMBEDDING_MODEL_SIZE` invalidates existing
collections — re-upload documents afterwards.

Frontend settings live in `frontend/.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://127.0.0.1:8000` | backend the dev server proxies to |
| `VITE_PORT` | `5173` | dev server port |
| `VITE_USE_MOCKS` | `false` | run the UI against an in-memory double instead |

## Tests

```bash
cd src && python -m pytest        # backend
cd frontend && npm test           # frontend
```

Neither suite needs MongoDB, a vector store, or an API key: both run against
in-memory doubles.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/data/projects` | list workspaces |
| `POST /api/v1/data/projects` | create a workspace |
| `GET /api/v1/data/files/{project_id}` | list a workspace's documents |
| `POST /api/v1/data/ingest/{project_id}` | upload + chunk + embed in one call |
| `POST /api/v1/nlp/answer/{project_id}` | streamed answer (SSE) |
| `POST /api/v1/nlp/index/search/{project_id}` | raw retrieval, useful for debugging |
| `POST /api/v1/nlp/index/answer/{project_id}` | non-streamed answer (JSON) |

The streaming endpoint emits JSON payloads over Server-Sent Events:

```
data: {"type":"sources","value":[{"text":"…","score":0.71}]}
data: {"type":"token","value":"The "}
data: {"type":"done"}
data: {"type":"error","message":"…"}
```

## Troubleshooting

**Backend starts, then every request fails.** MongoDB credentials in `docker/.env`
do not match `MONGODB_URL` in `src/.env`. Note that changing `docker/.env` after
the container's first run has no effect — the root user is created once, on the
initial volume. Recreate it with `docker compose down -v` (this deletes the data).

**The UI loads but nothing works.** The backend must be on the port
`VITE_API_URL` names. Check <http://127.0.0.1:8000/api/v1/> responds.

**`ECONNREFUSED ::1:8000` in the Vite terminal.** Use `127.0.0.1` rather than
`localhost` in `VITE_API_URL`. Node 18 resolves `localhost` to IPv6 first, while
uvicorn binds IPv4 only by default.

**Answers say the documents do not cover something they clearly do.** The
retrieved chunk may have been split away from its context — tables are the usual
culprit. Re-ingest with a larger chunk size:
`POST /api/v1/data/ingest/{project_id}?chunk_size=1200&overlap_size=150`.

**`Cannot find native binding` from Tailwind.** Tailwind v4 requires Node 20+.
This project pins Tailwind 3, so this only appears if v4 gets installed.

**Answers stop mid-sentence.** Raise `GENERATION_DAFAULT_MAX_TOKENS` in `src/.env`.
