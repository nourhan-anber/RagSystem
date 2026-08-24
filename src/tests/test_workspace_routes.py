import io

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests.conftest import (
    FakeDB,
    FakeEmbeddingClient,
    FakeGenerationClient,
    FakeVectorDB,
)
from routes import data, nlp
from stores.llm.providers.templates.template_parser import TemplateParser


def build_app():
    app = FastAPI()
    app.include_router(data.data_router)
    app.include_router(nlp.nlp_router)
    app.db_client = FakeDB()
    app.vectordb_client = FakeVectorDB()
    app.embedding_client = FakeEmbeddingClient()
    app.generation_client = FakeGenerationClient()
    app.template_parser = TemplateParser(language="en", default_language="en")
    return app


# --- listing and creating workspaces ---------------------------------------

def test_workspace_list_starts_empty():
    response = TestClient(build_app()).get("/api/v1/data/projects")

    assert response.status_code == 200
    assert response.json()["projects"] == []


def test_creating_a_workspace_keeps_its_display_name():
    client = TestClient(build_app())

    response = client.post("/api/v1/data/projects", json={"name": "Q3 Research"})

    assert response.status_code == 200
    project = response.json()["project"]
    assert project["project_name"] == "Q3 Research"


def test_a_generated_workspace_id_satisfies_the_alphanumeric_rule():
    """project_id is validated as alphanumeric, so 'Q3 Research' cannot be the id."""
    client = TestClient(build_app())

    project = client.post("/api/v1/data/projects", json={"name": "Q3 Research"}).json()["project"]

    assert project["project_id"].isalnum()


def test_a_created_workspace_appears_in_the_list():
    client = TestClient(build_app())
    client.post("/api/v1/data/projects", json={"name": "Contracts"})

    listed = client.get("/api/v1/data/projects").json()["projects"]

    assert [p["project_name"] for p in listed] == ["Contracts"]


def test_a_workspace_needs_a_name():
    client = TestClient(build_app())

    assert client.post("/api/v1/data/projects", json={"name": "   "}).status_code == 422


# --- listing files ----------------------------------------------------------

def test_files_list_is_empty_for_an_unknown_workspace():
    response = TestClient(build_app()).get("/api/v1/data/files/nosuchproject")

    assert response.status_code == 200
    assert response.json()["files"] == []


def test_ingested_files_are_listed_under_their_original_name(project_files_cleanup):
    """Stored names carry a random uniqueness prefix that users should not see."""
    project_files_cleanup.append("pytestfiles")
    client = TestClient(build_app())

    client.post(
        "/api/v1/data/ingest/pytestfiles",
        files={"file": ("meeting notes.txt", io.BytesIO(b"some indexable content. " * 30), "text/plain")},
    )

    files = client.get("/api/v1/data/files/pytestfiles").json()["files"]

    assert len(files) == 1
    assert files[0]["file_name"] == "meetingnotes.txt"
    assert files[0]["size"] > 0
    assert files[0]["file_id"]
