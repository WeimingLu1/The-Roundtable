import json
import re
from fastapi import APIRouter
from app.models.schemas import TopicResponse
from app.services.llm import llm_service
from app.services.debate import TOPIC_SYSTEM_PROMPT

router = APIRouter()


def extract_json(text: str) -> dict | None:
    """Extract JSON object from text, handling markdown code blocks and double braces."""
    # Strip markdown code fences first
    text = re.sub(r'```json\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```\s*$', '', text)
    text = text.strip()

    # Handle double braces {{...}} by stripping one layer only
    if text.startswith('{{') and text.endswith('}}'):
        text = text[1:-1]

    if not text:
        return None

    # Try to find and parse JSON object starting from the first {
    try:
        start = text.find('{')
        if start >= 0:
            for i in range(start, min(start + 2000, len(text))):
                if text[i] == '{':
                    try:
                        result = json.loads(text[i:])
                        if isinstance(result, dict) and "topic" in result:
                            return result
                    except json.JSONDecodeError:
                        continue
    except Exception:
        pass
    return None


@router.post("/random", response_model=TopicResponse)
async def random_topic():
    response_text = await llm_service.generate_content(
        system=TOPIC_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": "请生成一个辩论主题，用中文输出。"}],
        max_tokens=512,
    )
    data = extract_json(response_text)
    if data and "topic" in data:
        return TopicResponse(topic=data["topic"], description=data.get("description"))
    # Fallback: return raw text if extraction failed
    fallback = response_text.strip() if response_text.strip() else "What topic should we debate?"
    return TopicResponse(topic=fallback)
