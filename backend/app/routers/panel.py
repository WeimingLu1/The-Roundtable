import json
import re
import uuid
from fastapi import APIRouter, Body
from app.models.schemas import PanelResponse, Participant
from app.services.llm import llm_service
from app.services.debate import PANEL_SYSTEM_PROMPT

router = APIRouter()

LOOKUP_SYSTEM_PROMPT = """你是一个辩论参与者信息生成器。根据给定的人名和辩论主题，生成他们的个人资料。

只返回有效的JSON对象（不要markdown，不要解释），格式如下：
{
  "name": "全名",
  "title": "职位/角色（1-2句话）",
  "stance": "对主题的立场（简短、可辩论、一句话）",
  "color": "十六进制颜色代码（如 #6366F1）"
}

要具体且真实。立场应该可辩论并反映独特的视角。
所有内容必须使用中文。"""


FALLBACK_PARTICIPANTS = [
    Participant(
        id="expert_1",
        name="张三",
        title="科技专家",
        stance="人工智能将深刻重塑人类文明",
        color="#6366F1",
    ),
    Participant(
        id="expert_2",
        name="李四",
        title="社会学者",
        stance="技术放大了我们的力量和愚蠢",
        color="#EC4899",
    ),
    Participant(
        id="expert_3",
        name="王五",
        title="哲学家",
        stance="意识形态掩盖了资本的矛盾",
        color="#F59E0B",
    ),
]


def extract_json_array(text: str) -> list | None:
    """Extract JSON array from text."""
    # Find array in text
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    try:
        data = json.loads(text.strip())
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    return None


def extract_json_object(text: str) -> dict | None:
    """Extract JSON object from text."""
    # Handle double braces
    if text.startswith('{{') and text.endswith('}}'):
        text = text[1:-1]

    # Try to find JSON object
    start = text.find('{')
    if start >= 0:
        for i in range(start, min(start + 2000, len(text))):
            if text[i] == '{':
                try:
                    result = json.loads(text[i:])
                    if isinstance(result, dict):
                        return result
                except json.JSONDecodeError:
                    continue
    return None


@router.post("/generate", response_model=PanelResponse)
async def generate_panel(body: dict = Body(...)):
    topic = body.get("topic", "")
    response_text = await llm_service.generate_content(
        system=PANEL_SYSTEM_PROMPT.format(topic=topic),
        messages=[{"role": "user", "content": f"Generate 3 debate participants for: {topic}"}],
        max_tokens=1024,
    )
    data = extract_json_array(response_text)
    if data and isinstance(data, list) and len(data) > 0:
        participants = []
        for i, p in enumerate(data):
            if isinstance(p, dict) and "name" in p:
                participants.append(Participant(
                    id=p.get("id", f"participant_{i+1}"),
                    name=p["name"],
                    title=p.get("title", ""),
                    stance=p.get("stance", "")[:50],  # Truncate to max 50 chars
                    color=p.get("color", "#6366F1"),
                ))
        if participants:
            return PanelResponse(participants=participants)
    return PanelResponse(participants=FALLBACK_PARTICIPANTS)


@router.post("/lookup", response_model=Participant)
async def lookup_participant(body: dict = Body(...)):
    """Look up a participant by name and generate their profile."""
    name = body.get("name", "").strip()
    topic = body.get("topic", "")

    if not name:
        raise ValueError("Name is required")

    response_text = await llm_service.generate_content(
        system=LOOKUP_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Name: {name}\nTopic: {topic}"}],
        max_tokens=512,
    )

    data = extract_json_object(response_text)
    if data and "name" in data:
        return Participant(
            id=f"participant_{uuid.uuid4().hex[:8]}",
            name=data.get("name", name),
            title=data.get("title", "")[:100],
            stance=data.get("stance", "")[:50],
            color=data.get("color", "#6366F1"),
        )

    # Fallback: return basic participant with the given name
    return Participant(
        id=f"participant_{uuid.uuid4().hex[:8]}",
        name=name,
        title="Expert",
        stance="No stance provided",
        color="#6366F1",
    )
