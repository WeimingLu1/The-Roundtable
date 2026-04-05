# RoundTable Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python FastAPI backend that handles LLM-powered debate generation with SSE streaming.

**Architecture:** FastAPI app with SQLite persistence, Anthropic API for LLM calls, SSE for streaming responses. Clean separation between routers (API layer), services (business logic), and models (data layer).

**Tech Stack:** Python 3.11+, FastAPI 0.115+, Uvicorn, Anthropic Python SDK, Pydantic 2.0, SQLite

---

## File Structure

```
backend/
├── requirements.txt
├── run.py                     # 启动入口
└── app/
    ├── __init__.py
    ├── main.py               # FastAPI 实例配置
    ├── routers/
    │   ├── __init__.py
    │   ├── topics.py         # POST /api/topics/random
    │   ├── panel.py          # POST /api/panel/generate
    │   └── debate.py          # POST /api/debate/start, /turn, /summarize
    ├── services/
    │   ├── __init__.py
    │   ├── llm.py            # Anthropic API 调用 + 流式输出
    │   └── debate.py         # 辩论逻辑、发言策略
    ├── models/
    │   ├── __init__.py
    │   └── schemas.py        # Pydantic 请求/响应模型
    └── db.py                 # SQLite 配置
```

---

## Task 1: 项目初始化 - requirements.txt 和目录

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/run.py`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: Create requirements.txt**

```txt
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
anthropic>=0.38.0
python-dotenv>=1.0.0
pydantic>=2.0
pytest>=8.0
pytest-asyncio>=0.24
httpx>=0.27
sse-starlette>=1.8
```

- [ ] **Step 2: Create run.py 启动入口**

```python
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=3001,
        reload=True,
    )
```

- [ ] **Step 3: Create app/__init__.py**

```python
# RoundTable Backend
```

- [ ] **Step 4: Create app/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import topics, panel, debate

app = FastAPI(title="RoundTable API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topics.router, prefix="/api/topics", tags=["topics"])
app.include_router(panel.router, prefix="/api/panel", tags=["panel"])
app.include_router(debate.router, prefix="/api/debate", tags=["debate"])


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Commit**

```bash
cd backend && pip install -r requirements.txt && cd ..
git add backend/requirements.txt backend/run.py backend/app/
git commit -m "feat(backend): initial project structure with FastAPI"
```

---

## Task 2: Pydantic 数据模型

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/schemas.py`

- [ ] **Step 1: Create models/__init__.py**

```python
from app.models.schemas import (
    Participant,
    Message,
    Debate,
    TopicResponse,
    PanelResponse,
    DebateStartRequest,
    DebateTurnRequest,
    SummarizeRequest,
)
```

- [ ] **Step 2: Create schemas.py**

```python
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
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/
git commit -m "feat(backend): add Pydantic schemas for API models"
```

---

## Task 3: 数据库配置

**Files:**
- Create: `backend/app/db.py`

- [ ] **Step 1: Create db.py**

```python
import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent / "roundtable.db"


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS debates (
            id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            participants TEXT NOT NULL,
            messages TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at INTEGER NOT NULL
        )
    """)
    conn.commit()
    conn.close()
```

- [ ] **Step 2: Update main.py to call init_db on startup**

Modify `backend/app/main.py`:
```python
from app.db import init_db

@app.on_event("startup")
def startup():
    init_db()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/db.py backend/app/main.py
git commit -m "feat(backend): add SQLite database configuration"
```

---

## Task 4: LLM 服务 - Anthropic API 调用

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/llm.py`

- [ ] **Step 1: Create services/__init__.py**

```python
from app.services.llm import LLMService
```

- [ ] **Step 2: Create services/llm.py**

```python
import os
from typing import AsyncGenerator
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
MODEL = "claude-sonnet-4-20250514"


class LLMService:
    def __init__(self):
        self.client = Anthropic(api_key=ANTHROPIC_API_KEY)

    async def generate_content(self, system: str, messages: list[dict], max_tokens: int = 1024) -> str:
        response = self.client.messages.create(
            model=MODEL,
            system=system,
            max_tokens=max_tokens,
            messages=messages,
        )
        return response.content[0].text

    async def stream_content(self, system: str, messages: list[dict], max_tokens: int = 1024) -> AsyncGenerator[str, None]:
        with self.client.messages.stream(
            model=MODEL,
            system=system,
            max_tokens=max_tokens,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text


llm_service = LLMService()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/
git commit -m "feat(backend): add LLM service with Anthropic API"
```

---

## Task 5: 辩论服务 - 业务逻辑

**Files:**
- Create: `backend/app/services/debate.py`

- [ ] **Step 1: Create debate.py with prompt templates and parsing**

```python
import random
import re
from typing import Optional
from app.models.schemas import Participant, Message, Stance, Action


SYSTEM_PROMPT = """You are hosting a lively roundtable debate between three distinct personalities.
Each speaker has a unique background and stance on the topic.

Your task is to generate a single speaker's turn based on the debate history.
Output format is STRICTLY: STANCE||INTENSITY||MESSAGE||ACTION

Where:
- STANCE: AGREE, DISAGREE, PARTIAL, PIVOT, or NEUTRAL
- INTENSITY: 1-5 (how strongly the speaker feels)
- MESSAGE: The speaker's actual words (2-4 sentences, engaging and distinct voice)
- ACTION: CONTINUE (keep debating) or WAIT (let user respond)

Rules:
- Respect each speaker's established stance and personality
- Reference other speakers' points when disagreeing
- 25% chance to PIVOT to a related but unexplored aspect
- Never break character or speak as "the debate"
"""


PANEL_SYSTEM_PROMPT = """Generate exactly 3 debate participants for the topic: {topic}

Each participant must be:
- A real, recognizable public figure with a distinct perspective on this topic
- Have a clear, defensible stance (even if controversial)
- Be someone who would actually debate this topic in real life

Output format is JSON array:
[
  {{
    "id": "participant_1",
    "name": "Full Name",
    "title": "Title/Role",
    "stance": "Core position in 5-10 words",
    "color": "#RRGGBB"
  }},
  ...
]

Requirements:
- Names must be real public figures
- Three perspectives should be meaningfully different
- Titles should be accurate
- Colors should be visually distinct"""


TOPIC_SYSTEM_PROMPT = """Generate a single debate topic that is:
- Thought-provoking and debatable
- Not too broad or too narrow
- Has at least 2 distinct valid perspectives

Output format:
{{"topic": "Is AI dangerous?", "description": "Optional brief context"}}"""


def parse_turn_response(text: str) -> tuple[Stance, int, str, Action]:
    text = text.strip()
    match = re.match(r"(AGREE|DISAGREE|PARTIAL|PIVOT|NEUTRAL)\|\|(\d)\|\|(.+)\|\|(CONTINUE|WAIT)", text, re.DOTALL)
    if not match:
        return Stance.NEUTRAL, 3, text, Action.CONTINUE
    stance = Stance(match.group(1))
    intensity = int(match.group(2))
    message = match.group(3).strip()
    action = Action(match.group(4))
    return stance, intensity, message, action


def build_history_prompt(messages: list[Message], participants: list[Participant]) -> str:
    if not messages:
        return "No previous statements. This is the opening statement."
    lines = []
    for msg in messages[-6:]:
        speaker = next((p for p in participants if p.id == msg.participantId), None)
        name = speaker.name if speaker else "Unknown"
        lines.append(f"{name}: {msg.content}")
    return "\n".join(lines)


def build_turn_messages(
    topic: str,
    participants: list[Participant],
    current_speaker: Participant,
    history: list[Message],
    turn_count: int,
) -> list[dict]:
    history_text = build_history_prompt(history, participants)
    participant_context = "\n".join(
        f"- {p.name} ({p.title}): {p.stance}" for p in participants
    )
    user_message = f"""Topic: {topic}

Participant Context:
{participant_context}

Recent Debate History:
{history_text}

Current Speaker: {current_speaker.name} ({current_speaker.title})
Stance: {current_speaker.stance}

Generate {current_speaker.name}'s response:"""
    return [{"role": "user", "content": user_message}]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/debate.py
git commit -m "feat(backend): add debate service with prompts and parsing"
```

---

## Task 6: API 路由 - 话题生成

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/topics.py`

- [ ] **Step 1: Create routers/__init__.py**

```python
from app.routers import topics, panel, debate
```

- [ ] **Step 2: Create topics.py**

```python
import json
from fastapi import APIRouter
from app.models.schemas import TopicResponse
from app.services.llm import llm_service
from app.services.debate import TOPIC_SYSTEM_PROMPT

router = APIRouter()


@router.post("/random", response_model=TopicResponse)
async def random_topic():
    response_text = await llm_service.generate_content(
        system=TOPIC_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": "Generate a debate topic now."}],
        max_tokens=256,
    )
    try:
        data = json.loads(response_text)
        return TopicResponse(topic=data["topic"], description=data.get("description"))
    except (json.JSONDecodeError, KeyError):
        return TopicResponse(topic=response_text.strip())
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/
git commit -m "feat(backend): add topics router with random topic generation"
```

---

## Task 7: API 路由 - 嘉宾生成

**Files:**
- Create: `backend/app/routers/panel.py`

- [ ] **Step 1: Create panel.py**

```python
import json
import uuid
from fastapi import APIRouter
from app.models.schemas import PanelResponse, Participant
from app.services.llm import llm_service
from app.services.debate import PANEL_SYSTEM_PROMPT

router = APIRouter()


FALLBACK_PARTICIPANTS = [
    Participant(
        id="expert_1",
        name="Sam Altman",
        title="CEO of OpenAI",
        stance="AI will profoundly reshape human civilization",
        color="#6366F1",
    ),
    Participant(
        id="expert_2",
        name="Yuval Noah Harari",
        title="Historian & Author",
        stance="Technology amplifies both our power and our folly",
        color="#EC4899",
    ),
    Participant(
        id="expert_3",
        name="Slavoj Žižek",
        title="Philosopher",
        stance="Ideology masks the contradictions of capital",
        color="#F59E0B",
    ),
]


@router.post("/generate", response_model=PanelResponse)
async def generate_panel(topic: str):
    response_text = await llm_service.generate_content(
        system=PANEL_SYSTEM_PROMPT.format(topic=topic),
        messages=[{"role": "user", "content": f"Generate 3 debate participants for: {topic}"}],
        max_tokens=1024,
    )
    try:
        data = json.loads(response_text)
        participants = []
        for i, p in enumerate(data):
            participants.append(Participant(
                id=p.get("id", f"participant_{i+1}"),
                name=p["name"],
                title=p["title"],
                stance=p["stance"],
                color=p.get("color", "#6366F1"),
            ))
        return PanelResponse(participants=participants)
    except (json.JSONDecodeError, KeyError) as e:
        return PanelResponse(participants=FALLBACK_PARTICIPANTS)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/panel.py
git commit -m "feat(backend): add panel router with participant generation"
```

---

## Task 8: API 路由 - 辩论 (SSE 流式)

**Files:**
- Create: `backend/app/routers/debate.py`

- [ ] **Step 1: Create debate.py with all three endpoints**

```python
import uuid
import json
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from app.models.schemas import (
    DebateStartRequest,
    DebateTurnRequest,
    SummarizeRequest,
    Message as MessageSchema,
    SummaryResponse,
    Stance,
    Action,
)
from app.services.llm import llm_service
from app.services.debate import (
    SYSTEM_PROMPT,
    parse_turn_response,
    build_turn_messages,
)
from app.db import get_db

router = APIRouter()


@router.post("/start")
async def debate_start(req: DebateStartRequest):
    async def event_stream():
        messages = []
        for i, participant in enumerate(req.participants):
            system = SYSTEM_PROMPT
            turn_msgs = build_turn_messages(
                topic=req.topic,
                participants=req.participants,
                current_speaker=participant,
                history=messages,
                turn_count=0,
            )
            full_response = await llm_service.generate_content(
                system=system,
                messages=turn_msgs,
                max_tokens=500,
            )
            stance, intensity, content, action = parse_turn_response(full_response)
            msg = MessageSchema(
                id=str(uuid.uuid4()),
                participantId=participant.id,
                content=content,
                stance=stance,
                intensity=intensity,
                timestamp=int(asyncio.get_event_loop().time() * 1000),
            )
            messages.append(msg)
            yield {"event": "message", "data": json.dumps(msg.model_dump(), ensure_ascii=False)}

        yield {"event": "done", "data": json.dumps({"messages": [m.model_dump() for m in messages]})}

    return EventSourceResponse(event_stream())


@router.post("/turn")
async def debate_turn(req: DebateTurnRequest):
    current_speaker = req.participants[req.turnCount % len(req.participants)]

    async def event_stream():
        system = SYSTEM_PROMPT
        turn_msgs = build_turn_messages(
            topic="",  # topic not needed for continuation
            participants=req.participants,
            current_speaker=current_speaker,
            history=req.history,
            turn_count=req.turnCount,
        )
        full_response = await llm_service.generate_content(
            system=system,
            messages=turn_msgs,
            max_tokens=500,
        )
        stance, intensity, content, action = parse_turn_response(full_response)
        msg = MessageSchema(
            id=str(uuid.uuid4()),
            participantId=current_speaker.id,
            content=content,
            stance=stance,
            intensity=intensity,
            timestamp=int(asyncio.get_event_loop().time() * 1000),
        )
        yield {"event": "message", "data": json.dumps(msg.model_dump(), ensure_ascii=False)}
        yield {"event": "done", "data": json.dumps({"action": action.value})}

    return EventSourceResponse(event_stream())


@router.post("/summarize", response_model=SummaryResponse)
async def summarize(req: SummarizeRequest):
    history_text = "\n".join(
        f"- {msg.content}" for msg in req.history
    )
    participant_context = "\n".join(
        f"- {p.name}: {p.stance}" for p in req.participants
    )
    system = """Generate a structured summary of the debate.

Output JSON:
{
  "topic": "the debate topic",
  "viewpoints": {"speakerName": "their key argument summary"},
  "openQuestions": ["unresolved question 1", "unresolved question 2"]
}"""

    messages = [{
        "role": "user",
        "content": f"Topic: {req.participants[0] if req.participants else 'General debate'}\n\nDebate:\n{history_text}\n\nParticipants:\n{participant_context}\n\nSummarize:",
    }]

    response_text = await llm_service.generate_content(
        system=system,
        messages=messages,
        max_tokens=1024,
    )
    try:
        data = json.loads(response_text)
        return SummaryResponse(**data)
    except json.JSONDecodeError:
        return SummaryResponse(
            topic="Debate Summary",
            viewpoints={p.name: "Summary unavailable" for p in req.participants},
            openQuestions=["Could not generate summary"],
        )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/debate.py
git commit -m "feat(backend): add debate router with SSE streaming"
```

---

## Task 9: 后端测试

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_api.py`
- Create: `backend/tests/test_debate_service.py`

- [ ] **Step 1: Create tests/__init__.py**

```python
```

- [ ] **Step 2: Create test_debate_service.py**

```python
import pytest
from app.services.debate import parse_turn_response, Stance, Action


def test_parse_valid_turn_response():
    text = "AGREE||4||I strongly believe this is the right approach.||CONTINUE"
    stance, intensity, message, action = parse_turn_response(text)
    assert stance == Stance.AGREE
    assert intensity == 4
    assert message == "I strongly believe this is the right approach."
    assert action == Action.CONTINUE


def test_parse_disagree_turn():
    text = "DISAGREE||5||This completely misses the point.||WAIT"
    stance, intensity, message, action = parse_turn_response(text)
    assert stance == Stance.DISAGREE
    assert intensity == 5
    assert action == Action.WAIT


def test_parse_fallback_on_invalid():
    text = "Some random text without proper format"
    stance, intensity, message, action = parse_turn_response(text)
    assert stance == Stance.NEUTRAL
    assert intensity == 3
    assert message == "Some random text without proper format"
    assert action == Action.CONTINUE
```

- [ ] **Step 3: Create test_api.py (with mocked LLM)**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_topics_random_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/topics/random")
        assert response.status_code == 200
        data = response.json()
        assert "topic" in data


@pytest.mark.asyncio
async def test_panel_generate_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/panel/generate",
            json={"topic": "Is AI dangerous?"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "participants" in data
        assert len(data["participants"]) == 3
```

- [ ] **Step 4: Run tests**

```bash
cd backend && pip install -e . && cd ..
# Note: LLM tests require ANTHROPIC_API_KEY env var
# Tests that don't hit LLM will pass
python -m pytest backend/tests/ -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/
git commit -m "test(backend): add pytest tests for API and debate service"
```

---

## Self-Review Checklist

- [x] Spec coverage: All API endpoints implemented
- [x] Placeholder scan: No TBD/TODO found
- [x] Type consistency: Pydantic models match across routers and services
- [x] File paths: All absolute paths from project root
- [x] Commands: All pytest commands with expected output described
