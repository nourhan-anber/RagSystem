from .BaseController import BaseController
from models.ProjectModel import Project
from models.ChunkModel import DataChunk
from stores.llm.LLMEnums import DocumentTypoEnum
from typing import List
import json
import logging

class NLPController(BaseController):

    # Answering with no retrieved passages would invite the model to invent one.
    NO_DOCUMENTS_MESSAGE = (
        "No documents in this workspace matched your question, so there is "
        "nothing to answer from yet. Upload a document and try again."
    )
    
    def __init__(self, 
                 vectordb_client,
                 generation_client,
                 embedding_client,
                 template_parser):
        super().__init__()

        self.vectordb_client = vectordb_client
        self.generation_client = generation_client
        self.embedding_client = embedding_client
        self.template_parser = template_parser
        self.logger = logging.getLogger(__name__)

    def create_collection_name(self, project_id: str):
        return f"collection_{project_id}".strip()

    def reset_vector_db_collection(self, project: Project):
        collection_name = self.create_collection_name(
            project_id=project.project_id
        )

        return self.vectordb_client.delete_collection(collection_name=collection_name)

    def get_vector_db_collection_info(self, project: Project):
        collection_name = self.create_collection_name(
            project_id=project.project_id
        )

        collection_info = self.vectordb_client.get_collection_info(collection_name=collection_name)

        return json.loads(
            json.dumps( collection_info , default=lambda x:x.__dict__)
        )

    def index_into_vector_db(self, project: Project, 
                             chunks_ids : List[int],
                             chunks : List[DataChunk], 
                             do_reset: bool = False):
        collection_name = self.create_collection_name(
            project_id=project.project_id
        )

        texts = [ c.chunk_text for c in chunks]
        metadata = [ c.chunk_metadata for c in chunks]

        vectors = [

            self.embedding_client.embed_text(text=text,
                                             document_type= DocumentTypoEnum.DOCUMENT.value)
            for text in texts
        ]

        _ = self.vectordb_client.create_collection(
            collection_name=collection_name,
            embedding_size=self.embedding_client.embedding_size,
            do_reset=do_reset
        )

        _ = self.vectordb_client.insert_many(
            collection_name=collection_name,
            texts=texts,
            metadata=metadata,
            vectors=vectors,
            record_ids=chunks_ids
        )

        return True

    def search_vector_db_collection(self, project: Project,
                                    text: str,
                                    limit: int = 20):
        collection_name = self.create_collection_name(
            project_id=project.project_id
        )

        vector = self.embedding_client.embed_text(text=text,
                                             document_type= DocumentTypoEnum.QUERY.value)
        if not vector or len(vector) == 0:
            return False

        results = self.vectordb_client.search_by_vector(
            collection_name=collection_name,
            vector=vector,
            limit=limit
        )

        if not results:
            return False
        
        return results

    def build_rag_prompt(self, project: Project, query: str,
                         limit: int = 5, history: list = None):
        """
        Retrieves the passages relevant to a question and assembles the prompt.

        Kept separate from generation so both the streaming and non-streaming
        answer paths share one definition of what the model is asked, and so it
        can be exercised without calling an LLM.

        Returns (chat_history, full_prompt, sources). When nothing is retrieved,
        the prompt is None and sources is empty.
        """
        retrieved_documents = self.search_vector_db_collection(
            project=project,
            text=query,
            limit=limit
        )

        if not retrieved_documents:
            return None, None, []

        sources = [
            {"text": doc.text, "score": doc.score}
            for doc in retrieved_documents
        ]

        documents_prompt = "\n".join([
            self.template_parser.get("rag", "document_prompt", {
                "doc_num": idx + 1,
                "chunk_text": doc.text,
            })
            for idx, doc in enumerate(retrieved_documents)
        ])

        footer_prompt = self.template_parser.get("rag", "footer_prompt", {
            "query": query,
        })

        chat_history = [
            self.generation_client.construct_prompt(
                prompt=self.template_parser.get("rag", "system_prompt"),
                role=self.generation_client.enums.SYSTEM.value
            )
        ]

        # Earlier turns let follow-up questions ("why?") resolve against context.
        for turn in history or []:
            role = (
                self.generation_client.enums.ASSISTANT.value
                if turn.get("role") == "assistant"
                else self.generation_client.enums.USER.value
            )
            chat_history.append(
                self.generation_client.construct_prompt(prompt=turn.get("text", ""), role=role)
            )

        full_prompt = "\n\n".join([documents_prompt, footer_prompt])

        return chat_history, full_prompt, sources

    def answer_rag_question(self, project: Project, query: str,
                            limit: int = 20, history: list = None):
        chat_history, full_prompt, _ = self.build_rag_prompt(
            project=project, query=query, limit=limit, history=history
        )

        # Nothing retrieved: report it rather than referencing names that were
        # never bound, which previously turned an empty index into a 500.
        if full_prompt is None:
            return None, None, None

        answer = self.generation_client.generate_text(
            prompt=full_prompt,
            chat_history=chat_history
        )

        return answer, full_prompt, chat_history

    def stream_rag_answer(self, project: Project, query: str,
                          limit: int = 5, history: list = None):
        """
        Yields the answer as protocol events for the UI:

            {"type": "sources", "value": [...]}   retrieved passages, sent first
            {"type": "token",   "value": "..."}   one delta of the answer
            {"type": "done"}                      generation finished
            {"type": "error",   "message": "..."} generation failed

        The route serialises these as SSE frames; keeping them as plain dicts
        means the whole answer path is testable without HTTP or an LLM.
        """
        chat_history, full_prompt, sources = self.build_rag_prompt(
            project=project, query=query, limit=limit, history=history
        )

        yield {"type": "sources", "value": sources}

        if full_prompt is None:
            yield {"type": "token", "value": self.NO_DOCUMENTS_MESSAGE}
            yield {"type": "done"}
            return

        try:
            for delta in self.generation_client.generate_text_stream(
                prompt=full_prompt,
                chat_history=chat_history
            ):
                if delta:
                    yield {"type": "token", "value": delta}
        except Exception as exc:
            self.logger.error("Error while streaming the answer: %s", exc)
            yield {"type": "error", "message": str(exc)}
            return

        yield {"type": "done"}
