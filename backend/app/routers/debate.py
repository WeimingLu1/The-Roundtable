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

            # Stream the response tokens
            full_response = ""
            async for token in llm_service.stream_content(
                system=SYSTEM_PROMPT,
                messages=turn_msgs,
                max_tokens=500,
            ):
                full_response += token
                # Extract just the message content for preview (strip format prefix)
                # Format is STANCE||INTENSITY||CONTENT||ACTION
                if "||" in full_response:
                    parts = full_response.split("||")
                    if len(parts) >= 3:
                        # Get content after STANCE||INTENSITY||
                        parsed_content = "||".join(parts[2:]) if len(parts) > 3 else parts[2]
                    else:
                        parsed_content = full_response
                else:
                    parsed_content = full_response
                # Send partial content for typewriter effect
                msg_preview = MessageSchema(
                    id=f"preview-{participant.id}",
                    participantId=participant.id,
                    content=parsed_content,
                    stance="NEUTRAL",
                    intensity=3,
                    timestamp=int(asyncio.get_event_loop().time() * 1000),
                )
                yield {"event": "partial", "data": json.dumps(msg_preview.model_dump(), ensure_ascii=False)}

            # Parse final response
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
    # If user @mentioned someone, that person should speak next
    if req.mentionedId:
        mentioned_participant = next((p for p in req.participants if p.id == req.mentionedId), None)
        if mentioned_participant:
            current_speaker = mentioned_participant
        else:
            current_speaker = req.participants[req.turnCount % len(req.participants)]
    else:
        current_speaker = req.participants[req.turnCount % len(req.participants)]

    async def event_stream():
        turn_msgs = build_turn_messages(
            topic="",
            participants=req.participants,
            current_speaker=current_speaker,
            history=req.history,
            turn_count=req.turnCount,
        )

        # Stream the response tokens
        full_response = ""
        async for token in llm_service.stream_content(
            system=SYSTEM_PROMPT,
            messages=turn_msgs,
            max_tokens=500,
        ):
            full_response += token
            # Extract just the message content for preview (strip format prefix)
            # Format is STANCE||INTENSITY||CONTENT||ACTION
            if "||" in full_response:
                parts = full_response.split("||")
                if len(parts) >= 3:
                    # Get content after STANCE||INTENSITY||
                    parsed_content = "||".join(parts[2:]) if len(parts) > 3 else parts[2]
                else:
                    parsed_content = full_response
            else:
                parsed_content = full_response
            # Send partial content for typewriter effect
            msg_preview = MessageSchema(
                id=f"preview-{current_speaker.id}",
                participantId=current_speaker.id,
                content=parsed_content,
                stance="NEUTRAL",
                intensity=3,
                timestamp=int(asyncio.get_event_loop().time() * 1000),
            )
            yield {"event": "partial", "data": json.dumps(msg_preview.model_dump(), ensure_ascii=False)}

        # Parse final response
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
    system = """生成辩论的结构化摘要。

输出JSON格式：
{
  "topic": "辩论主题",
  "viewpoints": {"发言人姓名": "他们的主要观点总结"},
  "openQuestions": ["未解决的问题1", "未解决的问题2"]
}

所有内容必须使用中文。"""

    messages = [{
        "role": "user",
        "content": f"主题：{req.topic}\n\n辩论内容：\n{history_text}\n\n参与者：\n{participant_context}\n\n请总结：",
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
