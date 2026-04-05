import json
import uuid
from fastapi import APIRouter, Body
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
