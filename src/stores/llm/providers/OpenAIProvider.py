from ..LLMInterface import LLMInterface
from openai import OpenAI
import logging
from ..LLMEnums import OpenAIEnums

class OpenAIProvider(LLMInterface):

    def __init__(self, api_key: str, api_url: str=None,
                 default_input_max_characters: int=1000, 
                 default_generation_max_output_tokens: int=1000,
                 default_generation_temperature: float=0.1
                 ):
        self.api_key = api_key
        self.api_url = api_url

        self.default_input_max_characters = default_input_max_characters
        self.default_generation_max_output_tokens = default_generation_max_output_tokens
        self.default_generation_temperature = default_generation_temperature

        self.generation_model_id = None

        self.embedding_model_id = None
        self.embedding_size = None

        self.enums = OpenAIEnums

        self.client = OpenAI(
            api_key = self.api_key,
            base_url = self.api_url if self.api_url and len(self.api_url) else None
        )

        self.logger = logging.getLogger(__name__)

    def set_generation_model(self, model_id: str):
        self.generation_model_id = model_id

    def set_embedding_model(self, model_id: str, embedding_size: int):
        self.embedding_model_id = model_id
        self.embedding_size = embedding_size

    def _build_messages(self, prompt: str, chat_history: list = None):
        # A copy: the caller's history must survive the call unchanged, and a
        # shared default list would accumulate messages across every request.
        messages = list(chat_history or [])
        messages.append(
            self.construct_prompt(prompt=prompt, role=OpenAIEnums.USER.value)
        )
        return messages

    def _generation_params(self, max_output_tokens: int = None, temperature: float = None):
        return (
            max_output_tokens if max_output_tokens else self.default_generation_max_output_tokens,
            temperature if temperature is not None else self.default_generation_temperature,
        )

    def generate_text(self, prompt: str, chat_history: list = None,
                      max_output_tokens: int = None, temperature: float = None):
        if not self.client:
            self.logger.error("OpenAI client was not set")
            return None

        if not self.generation_model_id:
            self.logger.error("Generation model for OpenAI was not set")
            return None

        max_output_tokens, temperature = self._generation_params(max_output_tokens, temperature)

        response = self.client.chat.completions.create(
            model=self.generation_model_id,
            messages=self._build_messages(prompt, chat_history),
            max_tokens=max_output_tokens,
            temperature=temperature,
        )

        if not response or not response.choices or len(response.choices) == 0 \
                or not response.choices[0].message:
            self.logger.error("Error while generating text with OpenAI")
            return None

        return response.choices[0].message.content

    def generate_text_stream(self, prompt: str, chat_history: list = None,
                             max_output_tokens: int = None, temperature: float = None):
        """Yields the answer in deltas as the model produces them."""
        if not self.client:
            self.logger.error("OpenAI client was not set")
            return

        if not self.generation_model_id:
            self.logger.error("Generation model for OpenAI was not set")
            return

        max_output_tokens, temperature = self._generation_params(max_output_tokens, temperature)

        stream = self.client.chat.completions.create(
            model=self.generation_model_id,
            messages=self._build_messages(prompt, chat_history),
            max_tokens=max_output_tokens,
            temperature=temperature,
            stream=True,
        )

        for chunk in stream:
            if not getattr(chunk, "choices", None):
                continue

            content = getattr(chunk.choices[0].delta, "content", None)
            if content:
                yield content

    def embed_text(self, text: str, document_type: str):
        if not self.client:
            self.logger.error("OpenAI client was not set")
            return None

        if not self.embedding_model_id:
            self.logger.error("Embedding model for OpenAI was not set")
            return None

        response = self.client.embeddings.create(
            model = self.embedding_model_id,
            input = text
        )

        if not response or not response.data or not len(response) == 0 or not response.data[0].embedding:
            self.logger.error("Error while embedding text with OpenAI")
            return None

        return response.data[0].embedding

    def construct_prompt(self, prompt: str, role: str):
        return {
            "role": role,
            "content": prompt.strip()
        }

    def process_text(self, text: str):
        """
        Caps a single raw text before it is embedded.

        Deliberately NOT applied to a composed generation prompt: that prompt
        ends with the user's question, so capping it silently discards the
        question and the model is left summarising documents it was never
        asked about. Prompt size is controlled by the retrieval `limit`.
        """
        return text[:self.default_input_max_characters].strip()
