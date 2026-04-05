import json
import re
from fastapi import APIRouter
from app.models.schemas import TopicResponse
from app.services.llm import llm_service
from app.services.debate import TOPIC_SYSTEM_PROMPT

router = APIRouter()


def extract_json(text: str) -> dict | None:
    """Extract JSON object from text, handling markdown code blocks."""
    # Find JSON object in text ( {...} )
    match = re.search(r'\{[^{}]*"topic"[^{}]*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    # Try parsing whole text as JSON
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    return None


@router.post("/random", response_model=TopicResponse)
async def random_topic():
    response_text = await llm_service.generate_content(
        system=TOPIC_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": "Generate a debate topic now."}],
        max_tokens=256,
    )
    data = extract_json(response_text)
    if data and "topic" in data:
        return TopicResponse(topic=data["topic"], description=data.get("description"))
    return TopicResponse(topic=response_text.strip())
