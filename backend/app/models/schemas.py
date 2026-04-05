from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class Stance(str, Enum):
    AGREE = "AGREE"
    DISAGREE = "DISAGREE"
    PARTIAL = "PARTIAL"
    PIVOT = "PIVOT"
    NEUTRAL = "NEUTRAL"


class Action(str, Enum):
    CONTINUE = "CONTINUE"
    WAIT = "WAIT"


class Participant(BaseModel):
    id: str
    name: str
    title: str
    stance: str = Field(max_length=50)
    color: str  # #RRGGBB


class Message(BaseModel):
    id: str
    participantId: str
    content: str
    stance: Optional[Stance] = None
    intensity: Optional[int] = Field(default=None, ge=1, le=5)
    timestamp: int


class DebateStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"


class Debate(BaseModel):
    id: str
    topic: str
    participants: list[Participant]
    messages: list[Message] = []
    status: DebateStatus = DebateStatus.PENDING


class TopicResponse(BaseModel):
    topic: str
    description: Optional[str] = None


class PanelResponse(BaseModel):
    participants: list[Participant]


class DebateStartRequest(BaseModel):
    topic: str
    participants: list[Participant]


class DebateTurnRequest(BaseModel):
    debateId: str
    history: list[Message]
    participants: list[Participant]
    turnCount: int
    maxTurns: int = 3


class TurnResponse(BaseModel):
    message: Message
    action: Action
    nextSpeakerId: str


class SummaryResponse(BaseModel):
    topic: str
    viewpoints: dict[str, str]
    openQuestions: list[str]


class SummarizeRequest(BaseModel):
    topic: str
    history: list[Message]
    participants: list[Participant]
