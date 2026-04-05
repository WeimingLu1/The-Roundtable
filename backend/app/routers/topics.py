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
