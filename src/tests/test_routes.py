import io
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests.conftest import (
    Doc,
    FakeDB,
    FakeEmbeddingClient,
    FakeGenerationClient,
    FakeVectorDB,
)
from routes import data, nlp
from stores.llm.providers.templates.template_parser import TemplateParser


def build_app(vector_results=None, deltas=None):
    app = FastAPI()
    app.include_router(data.data_router)
    app.include_router(nlp.nlp_router)

    app.db_client = FakeDB()
    app.vectordb_client = FakeVectorDB(results=vector_results)
    app.embedding_client = FakeEmbeddingClient()
    app.generation_client = FakeGenerationClient(deltas=deltas)
    app.template_parser = TemplateParser(language="en", default_language="en")
    return app


def frames(response):
    return [
        json.loads(line[len("data: "):])
        for line in response.text.split("\n\n")
        if line.startswith("data: ")
    ]


# --- answer route -----------------------------------------------------------

def test_answer_streams_sources_then_tokens_then_done():
    app = build_app(vector_results=[Doc("chunk one", 0.9)], deltas=["Hel", "lo"])

    response = TestClient(app).post("/api/v1/nlp/answer/proj1", json={"text": "what?"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert frames(response) == [
        {"type": "sources", "value": [{"text": "chunk one", "score": 0.9}]},
        {"type": "token", "value": "Hel"},
        {"type": "token", "value": "lo"},
        {"type": "done"},
    ]


def test_answer_explains_an_empty_index_rather_than_failing():
    app = build_app(vector_results=[])

    response = TestClient(app).post("/api/v1/nlp/answer/proj1", json={"text": "what?"})

    assert response.status_code == 200
    events = frames(response)
    assert events[0] == {"type": "sources", "value": []}
    assert events[-1] == {"type": "done"}


def test_answer_accepts_prior_turns_for_follow_up_questions():
    app = build_app(vector_results=[Doc("chunk one", 0.9)])

    response = TestClient(app).post(
        "/api/v1/nlp/answer/proj1",
        json={
            "text": "why?",
            "limit": 3,
            "history": [{"role": "user", "text": "earlier"}],
        },
    )

    assert response.status_code == 200
    assert frames(response)[-1] == {"type": "done"}


def test_answer_rejects_an_empty_question():
    app = build_app(vector_results=[Doc("chunk one", 0.9)])

    response = TestClient(app).post("/api/v1/nlp/answer/proj1", json={"text": "   "})

    assert response.status_code == 422


# --- ingest route -----------------------------------------------------------

def upload(client, project_id, name, content, content_type="text/plain"):
    return client.post(
        f"/api/v1/data/ingest/{project_id}",
        files={"file": (name, io.BytesIO(content), content_type)},
    )


def test_ingest_uploads_chunks_and_vectorises_in_one_call(project_files_cleanup):
    project_files_cleanup.append("pytestone")
    app = build_app()
    client = TestClient(app)

    body = ("Retrieval augmented generation combines search with generation. " * 20).encode()
    response = upload(client, "pytestone", "notes.txt", body)

    assert response.status_code == 200
    payload = response.json()
    assert payload["file_name"] == "notes.txt"
    assert payload["chunks"] > 0
    assert payload["file_id"]

    # The chunks reached the vector store, not just Mongo.
    assert app.vectordb_client.inserted
    assert len(app.vectordb_client.inserted[0]["texts"]) == payload["chunks"]


def test_ingest_rejects_an_unsupported_file_type(project_files_cleanup):
    project_files_cleanup.append("pytesttwo")
    app = build_app()

    response = upload(TestClient(app), "pytesttwo", "photo.png", b"\x89PNG", "image/png")

    assert response.status_code == 400
    assert response.json()["signal"] == "file_type_not_supported"


def test_ingest_gives_each_file_distinct_vector_ids(project_files_cleanup):
    """Restarting ids at zero per file would overwrite the previous file's vectors."""
    project_files_cleanup.append("pytestthree")
    app = build_app()
    client = TestClient(app)

    body = ("Some indexable sentence about documents. " * 20).encode()
    upload(client, "pytestthree", "one.txt", body)
    upload(client, "pytestthree", "two.txt", body)

    first, second = app.vectordb_client.inserted[0], app.vectordb_client.inserted[1]
    assert set(first["record_ids"]).isdisjoint(second["record_ids"])
