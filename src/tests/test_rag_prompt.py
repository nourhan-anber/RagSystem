from controllers import NLPController
from models.db_schemes import Project
from stores.llm.LLMEnums import OpenAIEnums
from stores.llm.providers.templates.template_parser import TemplateParser


class FakeEmbeddingClient:
    embedding_size = 4

    def __init__(self):
        self.calls = []

    def embed_text(self, text: str, document_type: str = None):
        self.calls.append((text, document_type))
        return [0.1, 0.2, 0.3, 0.4]


class FakeVectorDB:
    def __init__(self, results):
        self.results = results
        self.searched_with = None

    def search_by_vector(self, collection_name, vector, limit):
        self.searched_with = {"collection_name": collection_name, "limit": limit}
        return self.results


class FakeGenerationClient:
    """Mimics the provider surface the controller depends on."""

    enums = OpenAIEnums

    def __init__(self, answer="generated answer", deltas=None):
        self.answer = answer
        self.deltas = deltas or ["gen", "erated"]
        self.received = None

    def construct_prompt(self, prompt: str, role: str):
        return {"role": role, "content": prompt}

    def generate_text(self, prompt, chat_history=None, **kwargs):
        self.received = {"prompt": prompt, "chat_history": chat_history}
        return self.answer

    def generate_text_stream(self, prompt, chat_history=None, **kwargs):
        self.received = {"prompt": prompt, "chat_history": chat_history}
        return iter(self.deltas)


class Doc:
    def __init__(self, text, score):
        self.text = text
        self.score = score


def build_controller(results, generation_client=None):
    return NLPController(
        vectordb_client=FakeVectorDB(results),
        generation_client=generation_client or FakeGenerationClient(),
        embedding_client=FakeEmbeddingClient(),
        template_parser=TemplateParser(language="en", default_language="en"),
    )


PROJECT = Project(project_id="proj1")


# --- prompt construction ----------------------------------------------------

def test_prompt_embeds_the_question_as_a_query_not_a_document():
    controller = build_controller([Doc("chunk one", 0.9)])

    controller.build_rag_prompt(project=PROJECT, query="what is rag?")

    text, document_type = controller.embedding_client.calls[0]
    assert text == "what is rag?"
    assert document_type == "query"


def test_prompt_carries_every_retrieved_chunk():
    controller = build_controller([Doc("chunk one", 0.9), Doc("chunk two", 0.7)])

    _, prompt, _ = controller.build_rag_prompt(project=PROJECT, query="what is rag?")

    assert "chunk one" in prompt
    assert "chunk two" in prompt


def test_prompt_restates_the_question_after_the_documents():
    controller = build_controller([Doc("chunk one", 0.9)])

    _, prompt, _ = controller.build_rag_prompt(project=PROJECT, query="what is rag?")

    assert prompt.index("chunk one") < prompt.index("what is rag?")


def test_history_opens_with_a_system_instruction():
    controller = build_controller([Doc("chunk one", 0.9)])

    history, _, _ = controller.build_rag_prompt(project=PROJECT, query="q")

    assert history[0]["role"] == OpenAIEnums.SYSTEM.value
    assert "document" in history[0]["content"].lower()


def test_sources_are_returned_as_plain_serialisable_dicts():
    controller = build_controller([Doc("chunk one", 0.9)])

    _, _, sources = controller.build_rag_prompt(project=PROJECT, query="q")

    assert sources == [{"text": "chunk one", "score": 0.9}]


def test_no_matching_documents_yields_no_prompt():
    controller = build_controller([])

    _, prompt, sources = controller.build_rag_prompt(project=PROJECT, query="q")

    assert prompt is None
    assert sources == []


def test_search_is_scoped_to_the_project_collection():
    controller = build_controller([Doc("chunk one", 0.9)])

    controller.build_rag_prompt(project=PROJECT, query="q", limit=3)

    assert controller.vectordb_client.searched_with == {
        "collection_name": "collection_proj1",
        "limit": 3,
    }


def test_prior_turns_are_appended_to_the_history_with_provider_roles():
    controller = build_controller([Doc("chunk one", 0.9)])

    history, _, _ = controller.build_rag_prompt(
        project=PROJECT,
        query="why?",
        history=[{"role": "user", "text": "earlier"}, {"role": "assistant", "text": "reply"}],
    )

    assert [m["role"] for m in history] == [
        OpenAIEnums.SYSTEM.value,
        OpenAIEnums.USER.value,
        OpenAIEnums.ASSISTANT.value,
    ]
    assert history[1]["content"] == "earlier"


# --- non-streaming answer ---------------------------------------------------

def test_answer_returns_the_generated_text():
    controller = build_controller([Doc("chunk one", 0.9)])

    answer, _, _ = controller.answer_rag_question(project=PROJECT, query="q")

    assert answer == "generated answer"


def test_answer_reports_no_answer_instead_of_crashing_when_nothing_matches():
    """Previously raised UnboundLocalError, returning a 500 for an empty index."""
    controller = build_controller([])

    answer, prompt, history = controller.answer_rag_question(project=PROJECT, query="q")

    assert answer is None
    assert prompt is None
    assert history is None


# --- streaming --------------------------------------------------------------

def test_stream_emits_sources_before_any_token():
    controller = build_controller([Doc("chunk one", 0.9)])

    events = list(controller.stream_rag_answer(project=PROJECT, query="q"))

    assert events[0] == {"type": "sources", "value": [{"text": "chunk one", "score": 0.9}]}


def test_stream_emits_each_delta_then_done():
    client = FakeGenerationClient(deltas=["Hel", "lo"])
    controller = build_controller([Doc("chunk one", 0.9)], generation_client=client)

    events = list(controller.stream_rag_answer(project=PROJECT, query="q"))

    assert events[1:] == [
        {"type": "token", "value": "Hel"},
        {"type": "token", "value": "lo"},
        {"type": "done"},
    ]


def test_stream_explains_an_empty_index_rather_than_inventing_an_answer():
    controller = build_controller([])

    events = list(controller.stream_rag_answer(project=PROJECT, query="q"))

    assert events[0] == {"type": "sources", "value": []}
    assert events[-1] == {"type": "done"}
    spoken = "".join(e["value"] for e in events if e["type"] == "token")
    assert "no" in spoken.lower() and "document" in spoken.lower()


def test_stream_reports_generation_failure_as_an_error_event():
    class ExplodingClient(FakeGenerationClient):
        def generate_text_stream(self, prompt, chat_history=None, **kwargs):
            raise RuntimeError("llm unavailable")
            yield  # pragma: no cover - makes this a generator

    controller = build_controller([Doc("chunk one", 0.9)], generation_client=ExplodingClient())

    events = list(controller.stream_rag_answer(project=PROJECT, query="q"))

    assert events[-1]["type"] == "error"
    assert "llm unavailable" in events[-1]["message"]
