import os
import shutil
import sys

import pytest

# The app is run from src/ (imports look like `from routes import ...`), so the
# tests put src/ on the path rather than restructuring the package.
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SRC)

from bson import ObjectId  # noqa: E402


# --- in-memory stand-in for motor ------------------------------------------

def _matches(doc, query):
    return all(doc.get(key) == value for key, value in query.items())


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def skip(self, n):
        return FakeCursor(self._docs[n:])

    def limit(self, n):
        return FakeCursor(self._docs[:n])

    async def to_list(self, length=None):
        return self._docs if length is None else self._docs[:length]

    def __aiter__(self):
        self._iter = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


class FakeCollection:
    def __init__(self):
        self.docs = []

    async def create_index(self, *args, **kwargs):
        return None

    async def find_one(self, query):
        return next((d for d in self.docs if _matches(d, query)), None)

    async def insert_one(self, doc):
        doc = dict(doc)
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)
        return type("Result", (), {"inserted_id": doc["_id"]})()

    def find(self, query=None):
        query = query or {}
        return FakeCursor([d for d in self.docs if _matches(d, query)])

    async def count_documents(self, query=None):
        return len(self.find(query)._docs)

    async def bulk_write(self, operations):
        for operation in operations:
            doc = dict(getattr(operation, "_doc", {}))
            doc.setdefault("_id", ObjectId())
            self.docs.append(doc)
        return type("Result", (), {"inserted_count": len(operations)})()

    async def delete_many(self, query):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches(d, query)]
        return type("Result", (), {"deleted_count": before - len(self.docs)})()


class FakeDB:
    def __init__(self):
        self._collections = {}

    def __getitem__(self, name):
        return self._collections.setdefault(name, FakeCollection())

    async def list_collection_names(self):
        return list(self._collections)


# --- stand-ins for the LLM and vector stores --------------------------------

class FakeEmbeddingClient:
    embedding_size = 4

    def embed_text(self, text, document_type=None):
        return [0.1, 0.2, 0.3, 0.4]


class FakeVectorDB:
    def __init__(self, results=None):
        self.results = results or []
        self.inserted = []
        self.collections = {}

    def create_collection(self, collection_name, embedding_size, do_reset=False):
        self.collections.setdefault(collection_name, 0)
        return True

    def is_collection_existed(self, collection_name):
        return collection_name in self.collections

    def get_collection_info(self, collection_name):
        return {"points_count": self.collections.get(collection_name, 0)}

    def insert_many(self, collection_name, texts, vectors, metadata=None,
                    record_ids=None, batch_size=50):
        self.inserted.append({"collection_name": collection_name, "texts": texts,
                              "record_ids": record_ids})
        self.collections[collection_name] = self.collections.get(collection_name, 0) + len(texts)
        return True

    def search_by_vector(self, collection_name, vector, limit):
        return self.results


class Doc:
    def __init__(self, text, score):
        self.text = text
        self.score = score


class FakeGenerationClient:
    from stores.llm.LLMEnums import OpenAIEnums as _E
    enums = _E

    def __init__(self, deltas=None):
        self.deltas = deltas if deltas is not None else ["Hel", "lo"]

    def construct_prompt(self, prompt, role):
        return {"role": role, "content": prompt}

    def generate_text(self, prompt, chat_history=None, **kwargs):
        return "".join(self.deltas)

    def generate_text_stream(self, prompt, chat_history=None, **kwargs):
        return iter(self.deltas)


@pytest.fixture
def project_files_cleanup():
    """Ingest writes real files; remove whatever a test created."""
    created = []
    yield created
    for project_id in created:
        path = os.path.join(SRC, "assets", "files", project_id)
        shutil.rmtree(path, ignore_errors=True)
