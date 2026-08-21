from .BaseController import BaseController
from models.ProjectModel import Project
from models.ChunkModel import DataChunk
from stores.llm.LLMEnums import DocumentTypoEnum
from typing import List
import json

class NLPController(BaseController):
    
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

    def answer_rag_question(self,
                            project: Project,
                            query: str,
                            limit: int = 20
                            ):
        retrieved_documents = self.search_vector_db_collection(
            project=project,
            text=query,
            limit=limit)

        if not retrieved_documents or len(retrieved_documents) == 0:
            return answer, full_prompt, chat_history

        system_prompt = self.template_parser.get("rag", "system_prompt")

        documents_prompt = "\n".join([
            self.template_parser.get("rag", "document_prompt",{
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
                prompt= system_prompt,
                role= self.generation_client.enums.SYSTEM.value
            )
        ]

        full_prompt = "\n\n".join([documents_prompt, footer_prompt])

        answer = self.generation_client.generate_text(
            prompt= full_prompt,
            chat_history=chat_history
        )

        return answer, full_prompt, chat_history
        
        

