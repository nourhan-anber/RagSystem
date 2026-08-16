from ..LLMInterface import LLMInterface
import cohere
import logging
from ..LLMEnums import CoHereEnum, DocumentTypoEnum

class CoHereProvider(LLMInterface):

    def __init__(self, api_key: str,
                 default_input_max_characters: int=1000, 
                 default_generation_max_output_tokens: int=1000,
                 default_generation_temperature: float=0.1
                 ):
        self.api_key = api_key

        self.default_input_max_characters = default_input_max_characters
        self.default_generation_max_output_tokens = default_generation_max_output_tokens
        self.default_generation_temperature = default_generation_temperature

        self.generation_model_id = None

        self.embedding_model_id = None
        self.embedding_size = None

        self.client = cohere.Client(
            api_key = self.api_key
        )

        self.logger = logging.getLogger(__name__)

    def set_generation_model(self, model_id: str):
        self.generation_model_id = model_id

    def set_embedding_model(self, model_id: str, embedding_size: int):
        self.embedding_model_id = model_id
        self.embedding_size = embedding_size

    def generate_text(self, prompt: str, chat_history :list=[], max_output_tokens: int=None, temperature: float=None):
        if not self.client:
            self.logger.error("OpenAI client was not set")
            return None
        
        if not self.generation_model_id:
            self.logger.error("Generation model for OpenAI was not set")
            return None

        max_output_tokens = max_output_tokens if max_output_tokens else self.default_generation_max_output_tokens
        temperature = temperature if temperature else self.default_generation_temperature

        response = self.client.chat(
            model = self.generation_model_id,
            chat_history = chat_history,
            message = self.process_text(prompt),
            temperature = temperature,
            max_tokens = max_output_tokens
        )

        if not response or not response.choices or len(response.choices) == 0 or response.choices[0].message:
            self.logger.error("Error while generating text with OpenAI")
            return None

        return response.choices[0].message["content"]

    def embed_text(self, text: str, document_type: str):
        if not self.client:
            self.logger.error("OpenAI client was not set")
            return None

        if not self.embedding_model_id:
            self.logger.error("Embedding model for OpenAI was not set")
            return None

        input_type = CoHereEnum.DOCUMENT.value
        if document_type == DocumentTypoEnum.QUERY.value:
            input_type = CoHereEnum.QUERY.value

        response = self.client.embed(
            model = self.embedding_model_id,
            texts = [self.process_text(text)],
            input_type = input_type,
            embedding_types=['float'],

        )

        if not response or not response.embeddings or not response.embeddings.float:
            self.logger.error("Error while embedding text with CoHere")
            return None

        return response.embeddings.float[0]

    def construct_prompt(self, prompt: str, role: str):
        return {
            "role": role,
            "text": self.process_text(prompt)
        }

    def process_text(self, text:str):
        return text[:self.default_input_max_characters].strip()