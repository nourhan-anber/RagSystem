from pydantic import BaseModel, constr
from typing import List, Optional

class PushRequest(BaseModel):
    do_reset: Optional[int] = 0


class SearchRequest(BaseModel):
    text: str
    limit: Optional[int] = 5


class ChatTurn(BaseModel):
    role: str
    text: str


class AnswerRequest(BaseModel):
    # Whitespace-only questions are rejected before any retrieval happens.
    text: constr(strip_whitespace=True, min_length=1)
    limit: Optional[int] = 5
    history: Optional[List[ChatTurn]] = []
