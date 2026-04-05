import uuid
import json
import asyncio
from fastapi import APIRouter, Request
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
        for participant in req.participants:
            turn_msgs = build_turn_messages(
                topic=req.topic,
                participants=req.participants,
                current_speaker=participant,
                history=messages,
                turn_count=0,
            )
            full_response = await llm_service.generate_content(
                system=SYSTEM_PROMPT,
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
        turn_msgs = build_turn_messages(
            topic="",
            participants=req.participants,
            current_speaker=current_speaker,
            history=req.history,
            turn_count=req.turnCount,
        )
        full_response = await llm_service.generate_content(
            system=SYSTEM_PROMPT,
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
        "content": f"Topic: {req.topic}\n\nDebate:\n{history_text}\n\nParticipants:\n{participant_context}\n\nSummarize:",
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
            topic=req.topic,
            viewpoints={p.name: "Summary unavailable" for p in req.participants},
            openQuestions=["Could not generate summary"],
        )
