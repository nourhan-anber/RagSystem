import pytest

from stores.llm.providers.OpenAIProvider import OpenAIProvider
from stores.llm.providers.CoHereProvider import CoHereProvider


# --- fakes shaped like the vendor SDK responses -----------------------------

class FakeOpenAIResponse:
    def __init__(self, content):
        message = type("Message", (), {"content": content})()
        choice = type("Choice", (), {"message": message})()
        self.choices = [choice]


class FakeOpenAIChunk:
    def __init__(self, content):
        delta = type("Delta", (), {"content": content})()
        choice = type("Choice", (), {"delta": delta})()
        self.choices = [choice]


class FakeOpenAIClient:
    def __init__(self, response=None, stream=None):
        self._response = response
        self._stream = stream
        self.received = None
        self.chat = type("Chat", (), {"completions": self})()

    def create(self, **kwargs):
        self.received = kwargs
        return self._stream if kwargs.get("stream") else self._response


class FakeCohereResponse:
    def __init__(self, text):
        self.text = text


class FakeCohereClient:
    def __init__(self, response=None, stream=None):
        self._response = response
        self._stream = stream
        self.received = None

    def chat(self, **kwargs):
        self.received = kwargs
        return self._response

    def chat_stream(self, **kwargs):
        self.received = kwargs
        return iter(self._stream)


def cohere_event(text):
    return type("Event", (), {"event_type": "text-generation", "text": text})()


# --- OpenAI -----------------------------------------------------------------

def make_openai(client):
    provider = OpenAIProvider(api_key="test-key")
    provider.set_generation_model(model_id="gpt-test")
    provider.client = client
    return provider


def test_openai_returns_the_generated_text_on_a_successful_response():
    provider = make_openai(FakeOpenAIClient(response=FakeOpenAIResponse("the answer")))

    assert provider.generate_text(prompt="question") == "the answer"


def test_openai_returns_none_when_the_response_carries_no_choices():
    empty = type("Empty", (), {"choices": []})()
    provider = make_openai(FakeOpenAIClient(response=empty))

    assert provider.generate_text(prompt="question") is None


def test_openai_does_not_leak_history_between_calls():
    client = FakeOpenAIClient(response=FakeOpenAIResponse("ok"))
    provider = make_openai(client)

    provider.generate_text(prompt="first")
    provider.generate_text(prompt="second")

    # The second call must not still be carrying the first call's message.
    assert len(client.received["messages"]) == 1
    assert client.received["messages"][0]["content"] == "second"


def test_openai_does_not_mutate_the_history_it_was_given():
    provider = make_openai(FakeOpenAIClient(response=FakeOpenAIResponse("ok")))
    history = [{"role": "system", "content": "be brief"}]

    provider.generate_text(prompt="question", chat_history=history)

    assert history == [{"role": "system", "content": "be brief"}]


def test_openai_streams_each_delta_in_order():
    stream = [FakeOpenAIChunk("Hello"), FakeOpenAIChunk(None), FakeOpenAIChunk(" world")]
    client = FakeOpenAIClient(stream=stream)
    provider = make_openai(client)

    assert list(provider.generate_text_stream(prompt="q")) == ["Hello", " world"]
    assert client.received["stream"] is True


# --- Cohere -----------------------------------------------------------------

def make_cohere(client):
    provider = CoHereProvider(api_key="test-key")
    provider.set_generation_model(model_id="command-test")
    provider.client = client
    return provider


def test_cohere_returns_the_generated_text_from_its_own_response_shape():
    provider = make_cohere(FakeCohereClient(response=FakeCohereResponse("the answer")))

    assert provider.generate_text(prompt="question") == "the answer"


def test_cohere_returns_none_when_the_response_has_no_text():
    provider = make_cohere(FakeCohereClient(response=FakeCohereResponse("")))

    assert provider.generate_text(prompt="question") is None


def test_cohere_streams_only_text_generation_events():
    stream = [
        cohere_event("Hello"),
        type("Other", (), {"event_type": "stream-start", "text": "ignored"})(),
        cohere_event(" world"),
    ]
    provider = make_cohere(FakeCohereClient(stream=stream))

    assert list(provider.generate_text_stream(prompt="q")) == ["Hello", " world"]


# --- prompt integrity -------------------------------------------------------

LONG_PROMPT = ("## Document No: 1\n### Content: " + ("filler sentence about loads. " * 40)
               + "\n\nUsing only the documents above, answer the user's question."
               + "\n## Question:\nWhat is the basic wind speed?\n\n## Answer:")


def test_openai_sends_the_whole_prompt_including_the_trailing_question():
    """Truncating a composed RAG prompt cuts the question off the end."""
    client = FakeOpenAIClient(response=FakeOpenAIResponse("ok"))
    provider = make_openai(client)

    provider.generate_text(prompt=LONG_PROMPT)

    sent = client.received["messages"][-1]["content"]
    assert "What is the basic wind speed?" in sent
    assert sent == LONG_PROMPT


def test_openai_does_not_truncate_a_long_system_prompt():
    """The grounding rules are longer than the input cap; losing the tail loses rules."""
    provider = make_openai(FakeOpenAIClient(response=FakeOpenAIResponse("ok")))
    system = "rule. " * 300

    constructed = provider.construct_prompt(prompt=system, role="system")

    assert constructed["content"] == system.strip()


def test_cohere_sends_the_whole_prompt_including_the_trailing_question():
    client = FakeCohereClient(response=FakeCohereResponse("ok"))
    provider = make_cohere(client)

    provider.generate_text(prompt=LONG_PROMPT)

    assert client.received["message"] == LONG_PROMPT


def test_cohere_streaming_sends_the_whole_prompt():
    client = FakeCohereClient(stream=[cohere_event("ok")])
    provider = make_cohere(client)

    list(provider.generate_text_stream(prompt=LONG_PROMPT))

    assert "What is the basic wind speed?" in client.received["message"]


def test_cohere_still_caps_the_text_it_embeds():
    """The cap remains meaningful for a single text being embedded."""
    class FakeEmbedClient:
        def __init__(self):
            self.received = None

        def embed(self, **kwargs):
            self.received = kwargs
            return type("R", (), {"embeddings": type("E", (), {"float": [[0.1]]})()})()

    provider = CoHereProvider(api_key="test-key", default_input_max_characters=50)
    provider.set_embedding_model(model_id="embed-test", embedding_size=4)
    client = FakeEmbedClient()
    provider.client = client

    provider.embed_text(text="x" * 500, document_type="document")

    assert len(client.received["texts"][0]) == 50
