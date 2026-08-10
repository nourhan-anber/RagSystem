from pydantic import BaseModel, Field, validator
from typing import Optional
from bson.objectid import ObjectId

class DataChunk(BaseModel):
    id: Optional[ObjectId] = Field(default=None, alias="_id")
    chunk_project_id: ObjectId
    chunk_text: str = Field(..., min_length=1)
    chunk_metadata: Optional[dict] 
    chunk_order: int = Field(..., ge=0)

    class Config:
        arbitrary_types_allowed = True