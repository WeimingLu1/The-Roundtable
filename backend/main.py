import os
import random
import re
import json
import logging
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

class OpeningStatementRejected(Exception):
    """Raised when the AI produces a greeting instead of a substantive opening."""
    pass

# CORS - use environment variable for allowed origins (comma-separated)
# Example: ALLOWED_ORIGINS=https://example.com,http://localhost:3000
_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "").split(",") if os.environ.get("ALLOWED_ORIGINS") else ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:3002", "http://192.168.2.134:3002"]

# Initialize MiniMax API client (Anthropic API compatible)
api_key = os.environ.get("ANTHROPIC_API_KEY")
if not api_key:
    raise ValueError("ANTHROPIC_API_KEY environment variable is required")

base_url = os.environ.get("ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic/v1")
MODEL = "MiniMax-M2"  # Model name for MiniMax API

# HTTP client managed via lifespan
_http_client: httpx.AsyncClient | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create HTTP client
    global _http_client
    _http_client = httpx.AsyncClient(timeout=120.0)
    yield
    # Shutdown: close HTTP client
    if _http_client:
        await _http_client.aclose()
        _http_client = None

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        # Configure retry strategy for robustness
        retry_config = httpx.Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504],
        )
        _http_client = httpx.AsyncClient(
            timeout=120.0,
            retry=retry_config
        )
    return _http_client

AVATAR_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
    '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#84CC16'
]


# --- Request/Response Models ---
class UserContext(BaseModel):
    nickname: str = Field(min_length=1)
    identity: str = Field(min_length=1)
    language: str = Field(min_length=1)


class Message(BaseModel):
    senderId: str
    text: str
    stance: Optional[str] = None
    timestamp: Optional[int] = None
    isInterruption: Optional[bool] = False


class Participant(BaseModel):
    id: str
    name: str = Field(min_length=1)
    title: str = Field(min_length=1)
    stance: str = Field(min_length=1)
    roleType: Literal['expert', 'host', 'user']
    color: str


class GenerateRandomTopicRequest(BaseModel):
    language: str


class GeneratePanelRequest(BaseModel):
    topic: str
    userContext: UserContext


class GenerateSingleParticipantRequest(BaseModel):
    inputQuery: str
    topic: str
    userContext: UserContext


class PredictNextSpeakerRequest(BaseModel):
    topic: str
    participants: List[Participant]
    messageHistory: List[Message]
    userContext: UserContext
    turnCount: int


class GenerateTurnRequest(BaseModel):
    speakerId: str
    topic: str
    participants: List[Participant]
    messageHistory: List[Message]
    userContext: UserContext
    turnCount: int
    maxTurns: int
    isOpeningStatement: bool = False
    mentionedParticipantId: Optional[str] = None  # If @someone was used, their ID


class GenerateSummaryRequest(BaseModel):
    topic: str
    messageHistory: List[Message]
    participants: List[Participant]
    userContext: UserContext


# --- Helper ---
def _extract_from_thinking(text: str, json_mode: bool = False) -> str:
    """Try to extract the actual answer from a thinking block when the model ignores thinking_enabled=False."""
    cleaned = re.sub(r'^(thinking|思考|thoughts?)[：:]\s*', '', text.strip(), flags=re.IGNORECASE)

    if json_mode:
        json_match = re.search(r'\{[^{}]*"name"[^{}]*"title"[^{}]*"stance"[^{}]*\}', cleaned, re.DOTALL)
        if not json_match:
            json_match = re.search(r'\{[^{}]*"topic"[^{}]*"summary"[^{}]*\}', cleaned, re.DOTALL)
        if not json_match:
            json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if json_match:
            return json_match.group(0).strip()
        return None

    lines = [l.strip() for l in cleaned.split('\n') if l.strip()]
    if not lines:
        return cleaned

    meta_patterns = [
        r'^(thinking|思考|thoughts?)[：:]', r'^(thus|therefore|so|hence)[,\s]',
        r'^(we can|we must|we need|we should|i think|i will|i would|i need|i must|i can|i should)\b',
        r'^(let me|let us|let\'s)\b', r'^(the answer|the topic|the response|the question)\b',
        r'^(alternatively|however|but|looking|based on|given|according)\b',
        r'^(this is|that is|it is|there is|these are)\b', r'^(note[:]|ps[.:]|p\.s\.)',
        r'^(in conclusion|to conclude|in summary|finally|lastly)\b',
        r'^(the (user|prompt|instruction|model|assistant))\b',
        r'^(a (provocative|debatable|good|better|possible))\b',
        r'^(one (possible|option|approach|way))\b',
    ]
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i]
        is_meta = any(re.match(pat, line, re.IGNORECASE) for pat in meta_patterns)
        if not is_meta and len(line) >= 3:
            # Clean up leading hedges and trailing commentary
            line = re.sub(r'^(Maybe|Perhaps|Possibly|或许|也许|可能)\s+', '', line, flags=re.IGNORECASE)
            line = re.sub(r'\s*Count[：:\s].*$', '', line, flags=re.IGNORECASE)
            line = re.sub(r'\s*That\'?s?\s+\d+\s+(characters|words).*$', '', line, flags=re.IGNORECASE)
            line = re.sub(r'\s*\(\d+\s*(chars|characters|words|字)\).*$', '', line, flags=re.IGNORECASE)
            line = re.sub(r'\s+\d+\s*(chars|characters|words|字)\s*$', '', line, flags=re.IGNORECASE)
            line = line.strip().strip('"').strip()
            if line:
                return line
    return lines[-1]


async def get_ai_response(prompt: str, json_mode: bool = False, max_tokens: int = 1024) -> str:
    client = await get_http_client()

    data = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
        "thinking": {"type": "disabled"},
    }

    if json_mode:
        data["extra_body"] = {"response_format": {"type": "json_object"}}
        data["messages"] = [{"role": "user", "content": prompt.rstrip() + "\n\nRespond with ONLY valid JSON. No explanation, no markdown."}]
        data["max_tokens"] = max(4096, max_tokens)

    logger.debug(f"Calling AI API with prompt length: {len(prompt)}")
    request_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
    }
    response = await client.post(f"{base_url}/messages", json=data, headers=request_headers)
    response.raise_for_status()
    result = response.json()

    content = result.get("content", [])
    logger.info(f"AI response content types: {[b.get('type') for b in content]}")

    # Pass 1: prefer text blocks
    for block in content:
        if block.get("type") == "text":
            text_result = block.get("text", "").strip()
            if text_result:
                if text_result.startswith("```"):
                    code_fence_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text_result)
                    if code_fence_match:
                        text_result = code_fence_match.group(1).strip()
                    else:
                        lines = text_result.split("\n")
                        text_result = "\n".join(lines[1:]).strip()
                return text_result

    # Pass 2: fallback to thinking blocks — try to extract the real answer
    for block in content:
        if block.get("type") in ("thinking", "redacted_thinking"):
            thinking_text = block.get("thinking", "") or block.get("text", "") or ""
            if thinking_text.strip():
                logger.warning(f"No text block found, extracting from {block.get('type')} block")
                extracted = _extract_from_thinking(thinking_text.strip(), json_mode)
                if extracted:
                    logger.info(f"Extracted from thinking: {extracted[:100]}...")
                    return extracted
                if json_mode:
                    raise ValueError("Failed to extract JSON from thinking-only response")
                return thinking_text.strip()

    logger.error(f"Raw AI response: {json.dumps(result, indent=2)[:2000]}")
    raise ValueError("AI response contained no text block and no parseable JSON in thinking")


# --- Endpoints ---
@app.post("/api/generate_random_topic")
async def generate_random_topic(req: GenerateRandomTopicRequest):
    lang_instruction = "in Chinese" if req.language.lower() == "chinese" else "in English" if req.language.lower() == "english" else f"in {req.language}"

    # Pre-pick a random domain to force diversity — prevents model from defaulting to AI
    domains_en = [
        "politics", "philosophy", "ethics", "society", "economics", "education",
        "environment", "culture", "health", "law", "urban life", "psychology",
        "art", "sports", "food and agriculture", "history", "media and journalism",
        "family and relationships", "religion", "criminal justice"
    ]
    domains_cn = [
        "政治", "哲学", "伦理", "社会", "经济", "教育",
        "环境", "文化", "健康", "法律", "城市生活", "心理学",
        "艺术", "体育", "食品与农业", "历史", "媒体与新闻",
        "家庭与关系", "宗教", "刑事司法"
    ]
    is_chinese = req.language.lower() == "chinese"
    domain = random.choice(domains_cn if is_chinese else domains_en)

    prompt = f"""Generate ONE debate topic {lang_instruction} in the domain of {domain}.

The topic must be a provocative, debatable question or statement that intelligent people disagree on. Keep it under 15 words.

Respond with ONLY the topic text, no explanation, no labels."""

    try:
        text = await get_ai_response(prompt, max_tokens=512)
        if not text or len(text.strip()) < 5:
            raise ValueError("Empty or too short response from AI")
        return {"topic": text.strip()}
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error generating random topic: {e.response.status_code}")
        raise ValueError(f"AI service unavailable (HTTP {e.response.status_code})")
    except (ValueError, json.JSONDecodeError) as e:
        # Non-recoverable: bad response format
        logger.error(f"Invalid response format generating random topic: {e}")
        raise ValueError(f"Invalid AI response format")
    except Exception as e:
        logger.error(f"Unexpected error generating random topic: {e}")
        raise ValueError(f"Topic generation failed: {str(e)}")


@app.post("/api/generate_panel")
async def generate_panel(req: GeneratePanelRequest):
    lang_name = "Chinese" if req.userContext.language.lower() == "chinese" else req.userContext.language
    prompt = f"""Topic: {req.topic}
Language: {lang_name}

Select 3 diverse, REAL, LIVING people who can offer compelling, contrasting perspectives on this topic.

CRITICAL REQUIREMENTS:
- Choose people whose voices would create a LIVELY, UNPREDICTABLE debate. Mix backgrounds: academics, practitioners, artists, cultural critics, entrepreneurs, activists, philosophers, journalists, public intellectuals. Do NOT pick only professors and researchers.
- Each person must have a clear, distinct stance on "{req.topic}".
- Names, titles, and stances MUST be in {lang_name}.
- Think: who would make this a conversation worth listening to? Controversial but thoughtful figures are welcome.

Return JSON:
{{"participants": [{{"name": "?", "title": "?", "stance": "?"}}]}}"""
    try:
        text = await get_ai_response(prompt, json_mode=True, max_tokens=768)
        data = json.loads(text)
        participants = data.get("participants", [])
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error generating panel: {e.response.status_code}")
        raise ValueError(f"AI service unavailable (HTTP {e.response.status_code})")
    except (ValueError, json.JSONDecodeError) as e:
        logger.error(f"Invalid response format generating panel: {e}", exc_info=True)
        raise ValueError(f"Invalid AI response format")
    except Exception as e:
        logger.error(f"Error generating panel: {e}", exc_info=True)
        raise ValueError(f"Panel generation failed: {str(e)}")

    # Validate: must have exactly 3 participants with required fields
    if not isinstance(participants, list) or not participants:
        raise ValueError("Panel API returned no participants")

    # Graceful degradation: if fewer than 3, generate placeholders
    if len(participants) < 3:
        logger.warning(f"Panel API returned only {len(participants)} participant(s), padding to 3")
        default_english = [
            {"name": "Dr. Wei Chen", "title": "AI Ethics Researcher", "stance": "Concerned about AI alignment and safety."},
            {"name": "Prof. Marcus Lee", "title": "Technology Philosopher", "stance": "Optimistic about human-AI collaboration."},
        ]
        default_chinese = [
            {"name": "陈伟博士", "title": "人工智能伦理研究员", "stance": "关注人工智能对齐与安全问题。"},
            {"name": "马库斯·李教授", "title": "技术哲学家", "stance": "对人类与人工智能协作持乐观态度。"},
        ]
        default_participants = default_chinese if req.userContext.language.lower() == "chinese" else default_english
        while len(participants) < 3:
            participants.append(default_participants[len(participants) % len(default_participants)])

    for i, p in enumerate(participants):
        if not isinstance(p, dict):
            raise ValueError(f"Participant {i} is not an object")
        if not p.get("name") or not p.get("title") or not p.get("stance"):
            raise ValueError(f"Participant {i} missing required fields (name/title/stance): {p}")

    shuffled_colors = AVATAR_COLORS.copy()
    random.shuffle(shuffled_colors)

    result = []
    for i, p in enumerate(participants):
        result.append({
            "id": f"expert_{i}",
            "name": p["name"],
            "title": p["title"],
            "stance": p["stance"],
            "roleType": "expert",
            "color": shuffled_colors[i % len(shuffled_colors)]
        })
    return {"participants": result}


@app.post("/api/generate_single_participant")
async def generate_single_participant(req: GenerateSingleParticipantRequest):
    lang_name = "Chinese" if req.userContext.language.lower() == "chinese" else req.userContext.language
    prompt = f"""User Input: {req.inputQuery}
Topic: {req.topic}
Language: {lang_name}

IMPORTANT: Determine whether the user typed a specific person's name or a general description.

CASE 1 — SPECIFIC PERSON NAME: If "{req.inputQuery}" is the name of a specific real person (e.g., "迪丽热巴", "Taylor Swift", "Elon Musk", "梅西", "周杰伦"), you MUST return THAT EXACT person.
- The "name" field MUST equal "{req.inputQuery}" (or the standard form of that person's name in {lang_name}).
- The "title" field MUST be their real occupation (e.g., "演员/Actress", "歌手/Singer", "足球运动员/Football Player").
- The "stance" field MUST be a plausible, thoughtful position this specific person might take on the topic "{req.topic}". Even if they are not a traditional expert, construct a fair, interesting stance from their public persona. Everyone has opinions.
- DO NOT replace this person with someone "more relevant" to the topic. The user chose them deliberately.

CASE 2 — GENERAL DESCRIPTION: If "{req.inputQuery}" is a description, role, or organization (e.g., "a famous economist", "百度CEO", "an environmental activist"), find the best real, living person who matches that description and is relevant to the topic "{req.topic}".
- The "name" field should be that person's real name.

All fields MUST be in {lang_name}.
Return ONLY valid JSON: {{"name":"?","title":"?","stance":"?"}}"""
    try:
        text = await get_ai_response(prompt, json_mode=True, max_tokens=384)
        data = json.loads(text)
        if not isinstance(data, dict):
            raise ValueError(f"Invalid response type: expected dict, got {type(data).__name__}")
        for key in ("name", "title", "stance"):
            if not data.get(key):
                raise ValueError(f"Missing required field '{key}' in single participant response: {data}")

        # Guard: if input is clearly a specific person's name but AI returned a
        # completely different name, restore the input name.
        input_clean = req.inputQuery.strip()
        ai_name = (data.get("name") or "").strip()

        def is_person_name(s: str) -> bool:
            """Heuristic: returns True if s looks like a specific person's name, not a role/description."""
            # Pure Chinese name: 2-4 chars, all CJK (no Latin letters, no digits, no role words)
            if all('一' <= c <= '鿿' or '㐀' <= c <= '䶿' for c in s):
                if 2 <= len(s) <= 4:
                    return True
            # Western name: 2-3 words, each starting with uppercase
            parts = s.split()
            if 2 <= len(parts) <= 3 and all(p and p[0].isupper() and p.isalpha() for p in parts):
                return True
            return False

        if is_person_name(input_clean) and ai_name and input_clean.lower() != ai_name.lower():
            input_chars = set(input_clean.replace(' ', '').lower())
            ai_chars = set(ai_name.replace(' ', '').lower())
            overlap = input_chars & ai_chars
            if len(overlap) == 0:
                logger.warning(f"AI replaced specific person '{input_clean}' with '{ai_name}'. Forcing input name.")
                data["name"] = input_clean
                if not data.get("title") or data["title"] == ai_name:
                    data["title"] = "Public Figure"
                if not data.get("stance"):
                    data["stance"] = f"Has a unique perspective on {req.topic}."

        return data
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error generating single participant: {e.response.status_code}")
        raise ValueError(f"AI service unavailable (HTTP {e.response.status_code})")
    except (ValueError, json.JSONDecodeError) as e:
        logger.error(f"Invalid response format generating single participant: {e}")
        raise ValueError(f"Invalid AI response format")
    except Exception as e:
        logger.error(f"Unexpected error generating single participant: {e}")
        raise ValueError(f"Participant generation failed: {str(e)}")


@app.post("/api/predict_next_speaker")
async def predict_next_speaker(req: PredictNextSpeakerRequest):
    # Guard against empty message history
    if not req.messageHistory:
        return {"speakerId": req.participants[0].id if req.participants else "user"}

    last_message = req.messageHistory[-1]
    last_text = last_message.text if last_message else ""
    is_host_last = last_message.senderId == "user" if last_message else False

    # Guard against empty participants list
    if not req.participants:
        return {"speakerId": "user"}

    # Check @Mentions FIRST — always prioritize explicit @mentions
    # Use word-boundary-aware matching: @Name followed by non-alphanumeric or end of string
    for p in req.participants:
        pattern = r"@{}({}|\s|[^a-zA-Z0-9])".format(re.escape(p.name), "$")
        if re.search(pattern, last_text, re.IGNORECASE):
            return {"speakerId": p.id}

    # Format participants
    participants_list = ", ".join([f"{p.name} (ID: {p.id})" for p in req.participants])
    recent_history = "\n".join([
        f"{'HOST' if m.senderId == 'user' else next((p.name for p in req.participants if p.id == m.senderId), 'Unknown')}: {m.text[:100]}..."
        for m in req.messageHistory[-8:]
    ])

    # Compute prev_speaker early to avoid lambda scope issues in f-string
    prev_speaker = None
    if is_host_last and len(req.messageHistory) >= 2 and req.messageHistory[-2].senderId != "user":
        prev_speaker = next((p for p in req.participants if p.id == req.messageHistory[-2].senderId), None)

    rule2 = (
        f"2. **IMPLICIT CUE**: The Host just spoke after {prev_speaker.name} (ID: {prev_speaker.id}) without mentioning a name — this is an implicit cue for {prev_speaker.name} to respond, unless the Host's message is clearly asking a different specific person or is a general 'Anyone' question."
        if prev_speaker
        else "2. **DEBATE FLOW**: If no Host intervention, ensure variety. Do not let the same person speak twice in a row."
    )

    prompt = f"""
Topic: {req.topic}
Speakers: {participants_list}
History:
{recent_history}

Task: Pick the ID of the next speaker.
Current Turn: {req.turnCount}

Rules:
1. **HOST PRIORITY**: If the Host just spoke, their question/comment is the highest priority.
{rule2}
3. **STALLING**: If the debate is stalling, pick the person with the most opposing view.
4. **ANTI-DOMINATION**: Avoid letting any single speaker dominate. If someone has spoken 3+ times in recent turns, prefer someone else.

Surprise the discussion occasionally by picking an unexpected speaker. Return ONLY the ID (e.g., expert_1).
"""
    try:
        text = await get_ai_response(prompt)
        speaker_id = text.strip()
        valid = next((p.id for p in req.participants if p.id == speaker_id), None)
        if valid:
            # Occasionally (12%) override AI choice with a random different speaker
            if random.random() < 0.12:
                others = [p for p in req.participants if p.id != valid]
                if others:
                    valid = random.choice(others).id
            return {"speakerId": valid}
        # Safely filter out last speaker if last_message exists
        last_sender_id = last_message.senderId if last_message else None
        other_speakers = [p for p in req.participants if p.id != last_sender_id] if last_sender_id else list(req.participants)
        if other_speakers:
            return {"speakerId": random.choice(other_speakers).id}
        # Fallback: return any participant if other_speakers is empty
        return {"speakerId": req.participants[0].id}
    except Exception as e:
        logger.error(f"Error predicting next speaker: {e}")
        return {"speakerId": req.participants[0].id}


@app.post("/api/generate_turn")
async def generate_turn(req: GenerateTurnRequest):
    # Validate speakerId exists
    speaker = next((p for p in req.participants if p.id == req.speakerId), None)
    if not speaker:
        raise ValueError(f"Speaker ID '{req.speakerId}' not found in participants")
    speaker_name = speaker.name
    valid_names_list = ", ".join([p.name for p in req.participants])

    if req.isOpeningStatement:
        lang = req.userContext.language
        prompt = f"""
Role: You are {speaker_name}, {speaker.title}.
Core Stance: {speaker.stance}.
Topic: "{req.topic}"

Task: State your core argument clearly and naturally.
- You MUST speak in {lang}. All output text must be in {lang}.
- Speak like a real person in a lively podcast/salon, not a textbook.
- Vary your opening style: be provocative, personal, or storytelling -- not all openings should sound the same.
- Be direct but polite.
- Do not address other guests yet.
- Keep it under 50 words.
- ABSOLUTE PROHIBITION: Do NOT start with greetings like "Hello", "Hi everyone", "Good morning", "很高兴", "大家好", etc. Start directly with your substantive argument.

Output: Just the spoken text in {lang}. No labels, no greetings.
"""
        try:
            text = await get_ai_response(prompt)
            if not text or len(text.strip()) < 3:
                raise ValueError("Opening statement too short or empty")
            # Reject greeting-only responses
            greeting_patterns = ["hello", "hi", "good morning", "good afternoon", "good evening", "很高兴", "大家好", "各位好", "很高兴认识", "您好", "你好", "嗨", "greetings", "hey", "welcome", "dear", "亲爱的", "早", "晚上好", "下午好"]
            text_lower = text.strip().lower()
            if any(text_lower.startswith(g) for g in greeting_patterns):
                raise OpeningStatementRejected(f"Opening statement starts with greeting: {text[:50]}")
            return {"text": text.strip(), "stance": speaker.stance, "stanceIntensity": 3, "shouldWaitForUser": False}
        except OpeningStatementRejected:
            raise  # Re-raise with original message for retry
        except ValueError:
            raise  # Re-raise ValueError as-is for intentional rejections
        except Exception as e:
            logger.error(f"Opening statement error: {e}")
            raise ValueError(f"Opening statement generation failed: {str(e)}")

    # Discussion turn
    recent_history = "\n\n".join([
        f"{req.userContext.nickname} (HOST): {m.text}" if m.senderId == "user"
        else f"{next((p.name for p in req.participants if p.id == m.senderId), 'Unknown')}: {m.text}"
        for m in req.messageHistory[-15:]
    ])

    force_return_to_host = req.turnCount >= req.maxTurns
    last_message = req.messageHistory[-1] if req.messageHistory else None
    host_just_spoke = last_message.senderId == "user" if last_message else False
    last_was_pivot = last_message.stance == "PIVOT" if last_message and last_message.stance else False
    is_breadth_turn = not last_was_pivot and random.random() < (0.20 + 0.20 * (req.turnCount / max(1, req.maxTurns))) and not host_just_spoke

    strategy = "**STRATEGY: DIVERGE (Breadth)**. STOP dwelling on the current specific point. Abruptly SHIFT the lens to a NEW dimension. **MANDATORY**: Use stance 'PIVOT'." if is_breadth_turn else "**STRATEGY: CONVERGE (Depth)**. Drill deeper into the specific logic of the previous speaker."

    mentioned_in_last_host_msg = None
    if last_message and last_message.senderId == "user":
        # If the client explicitly provided a mentionedParticipantId, use it directly
        if req.mentionedParticipantId:
            mentioned_in_last_host_msg = next((p for p in req.participants if p.id == req.mentionedParticipantId), None)
        if not mentioned_in_last_host_msg:
            # Sort by name length descending to avoid substring mismatches (e.g. "Lee" matching before "Lee Chen")
            sorted_participants = sorted(req.participants, key=lambda p: len(p.name), reverse=True)
            for p in sorted_participants:
                if f"@{p.name.lower()}" in last_message.text.lower():
                    mentioned_in_last_host_msg = p
                    break

    # Override speaker selection if this speaker was @mentioned by host
    if mentioned_in_last_host_msg and req.speakerId == mentioned_in_last_host_msg.id:
        directives = f"CRITICAL: The Host (@{req.userContext.nickname}) just @mentioned you ({mentioned_in_last_host_msg.name}) and asked: \"{last_message.text[:100]}...\"\nINSTRUCTION: You MUST directly answer the Host's specific question as {mentioned_in_last_host_msg.name}. Do NOT pivot to other experts. Do NOT give a generic statement. Address the question head-on."
    elif host_just_spoke:
        directives = f"PRIORITY: The Host (@{req.userContext.nickname}) just spoke: \"{last_message.text}\". INSTRUCTION: Answer the Host directly. Do not pivot to others yet."
    elif force_return_to_host:
        directives = f"PRIORITY: This is the end of the current debate round. INSTRUCTION: You MUST cue the Host (@{req.userContext.nickname}) with a specific OPEN-ENDED QUESTION. 禁止: Do not cue other experts."
    else:
        directives = f"PRIORITY: Debate with your peers. You MAY naturally address the Host (@{req.userContext.nickname}) if you genuinely want their opinion or have a question for them. However, the debate should primarily flow between experts -- do NOT address the Host in every message."

    prompt = f"""
Context: A high-quality, intellectual roundtable discussion (Salon).
Topic: "{req.topic}"
Host: {req.userContext.nickname}
Valid Participants: {valid_names_list}

You are: {speaker_name} ({speaker.title}).
Starting Philosophy: {speaker.stance}.

Transcript (Recent Context):
{recent_history}

{directives}

ADDITIONAL RULES:
1. **LANGUAGE**: You MUST speak in {req.userContext.language}. All output must be in {req.userContext.language}.
2. **INTELLECTUAL FLEXIBILITY**: Do NOT be stubbornly dogmatic. If a previous speaker makes a strong point that contradicts your view, you should ACKNOWLEDGE it.
3. **STANCE & INTENSITY**: Decide your emotional/cognitive reaction. Choose from:
   [AGREE, DISAGREE, PARTIAL, PIVOT, NEUTRAL,
    SURPRISED, INTRIGUED, CHALLENGED, CONCEDE, BUILD_ON, CLARIFY, QUESTION].
   - AGREE/DISAGREE: React to the previous point. Intensity (1-5) sets strength: 1=Slightly, 5=Strongly.
   - SURPRISED: Taken aback by what you just heard.
   - INTRIGUED: Curious and want to explore further.
   - CHALLENGED: Your own position feels threatened and you push back.
   - CONCEDE: Yield a point to your opponent gracefully.
   - BUILD_ON: Extend or amplify the previous speaker's idea with your own spin.
   - CLARIFY: Correct a misunderstanding or sharpen a fuzzy point.
   - QUESTION: Pose a probing question to push the debate forward.
   - PIVOT: Shift to a new dimension (only when STRATEGY says DIVERGE).
4. {strategy}
5. **STYLE**: SINGLE FOCUS, EXTREME BREVITY (under 60 words), PLAIN LANGUAGE, DIRECTNESS. Vary your tone -- be witty, passionate, or contemplative. Use occasional rhetorical devices for impact.

Status:
- Current Turn: {req.turnCount}/{req.maxTurns}.
- Force Yield to Host: {force_return_to_host}.

Instruction:
**OUTPUT FORMAT STRICTLY**: "STANCE||INTENSITY||MESSAGE||ACTION"

Examples:
"DISAGREE||5||I completely reject that premise because...||CONTINUE"
"AGREE||4||You have convinced me...||CONTINUE"
"PIVOT||5||That is interesting, but we are completely ignoring...||CONTINUE"
"BUILD_ON||4||Excellent point about regulation. Let me add that market forces alone...||CONTINUE"
"INTRIGUED||3||I have to say, that makes me curious about the implications for...||CONTINUE"

Action is "WAIT" if force yielding, otherwise "CONTINUE".
"""
    try:
        text = await get_ai_response(prompt)
        raw = text.strip()
        # Split only on first 3 delimiters so message can legitimately contain ||
        parts = raw.split('||', 3)

        stance = "NEUTRAL"
        intensity = 3
        message = ""
        action = ""

        try:
            if len(parts) >= 4:
                stance = parts[0].strip().upper() if parts[0] else "NEUTRAL"
                intensity = int(parts[1].strip()) if parts[1].strip().isdigit() else 3
                message = parts[2].strip()
                action = parts[3].strip()
            elif len(parts) == 3:
                if parts[1].strip().isdigit():
                    stance = parts[0].strip().upper() if parts[0] else "NEUTRAL"
                    intensity = int(parts[1].strip())
                    message = parts[2].strip()
                else:
                    stance = parts[0].strip().upper() if parts[0] else "NEUTRAL"
                    message = parts[1].strip()
                    action = parts[2].strip()
            elif len(parts) == 2:
                stance = parts[0].strip().upper() if parts[0] else "NEUTRAL"
                message = parts[1].strip()
            else:
                message = raw
        except ValueError:
            # Malformed output — fall back to raw text
            stance = "NEUTRAL"
            intensity = 3
            action = ""

        # Validate and sanitize stance and intensity
        valid_stances = {"AGREE", "DISAGREE", "PARTIAL", "PIVOT", "NEUTRAL",
                         "SURPRISED", "INTRIGUED", "CHALLENGED", "CONCEDE",
                         "BUILD_ON", "CLARIFY", "QUESTION"}
        if stance not in valid_stances:
            logger.warning(f"Invalid stance '{stance}', defaulting to NEUTRAL")
            stance = "NEUTRAL"
        intensity = max(1, min(5, intensity))

        should_wait = "WAIT" in action.upper() or force_return_to_host or (re.search(r'\B@' + re.escape(req.userContext.nickname) + r'(?:\s|$|[^a-zA-Z0-9])', message, re.IGNORECASE) and "?" in message and req.turnCount > 0)

        return {
            "text": message,
            "stance": stance,
            "stanceIntensity": intensity,
            "shouldWaitForUser": should_wait
        }
    except Exception as e:
        logger.error(f"Error generating turn: {e}")
        raise ValueError(f"Discussion turn generation failed: {str(e)}")


@app.post("/api/generate_summary")
async def generate_summary(req: GenerateSummaryRequest):
    transcript = "\n".join([
        f"{'HOST' if m.senderId == 'user' else next((p.name for p in req.participants if p.id == m.senderId), 'Unknown')}: {m.text}"
        for m in req.messageHistory
    ])

    # Build participant context for summary (includes Host as a peer participant)
    participant_context = "\n".join([
        f"- {p.name} ({p.title}): Stance on topic = {p.stance}"
        for p in req.participants
    ] + [
        f"- {req.userContext.nickname} (HOST): Identity = {req.userContext.identity}. The Host is also a participant whose views should be summarized."
    ])

    prompt = f"""You are producing the official minutes of a high-quality intellectual roundtable discussion. Your summary must be THOROUGH, DETAILED, and INSIGHTFUL — not a generic overview.

Topic: {req.topic}

Participants:
{participant_context}

Language: {req.userContext.language}

Transcript (full discussion):
{transcript}

Your task: Write a comprehensive, detailed summary in {req.userContext.language}.

Return a JSON object with EXACTLY this structure:
{{
  "topic": "The discussion topic (1 sentence)",
  "summary": "A DETAILED 5-8 sentence narrative summary of the entire discussion. Capture the full arc: how the discussion started, the key arguments each participant made, how viewpoints evolved or clashed, major turning points, and where the discussion ended. Be SPECIFIC — reference actual arguments and quotes, not generic phrases.",
  "core_viewpoints": [
    {{
      "speaker": "EXACT name from the participant list above",
      "title": "their professional title",
      "stance": "their detailed position on the topic (2-3 sentences capturing nuance)",
      "key_points": ["specific point 1 with context", "specific point 2 with context", "specific point 3 with context", "specific point 4 with context"],
      "most_memorable_quote": "a verbatim or near-verbatim quote from the transcript that best captures their view"
    }}
  ],
  "key_discussion_moments": [
    "Detailed description of a pivotal exchange, clash, or breakthrough — include who said what and why it mattered"
  ],
  "questions": [
    {{
      "question": "A thought-provoking open question that emerged from the discussion",
      "why_unresolved": "Detailed explanation of why this question remains open, referencing specific points from the discussion"
    }}
  ],
  "conclusion": "A 2-4 sentence conclusion that synthesizes the overall discussion, identifies any emerging consensus or irreconcilable differences, and reflects on the broader implications"
}}

CRITICAL REQUIREMENTS:
- "core_viewpoints" MUST have exactly {len(req.participants) + 1} entries (one per expert plus the Host "{req.userContext.nickname}"). The Host's viewpoint MUST be the LAST entry.
- **HOST VIEWPOINT**: The Host ("{req.userContext.nickname}") is an active participant, not just a moderator. Carefully review ALL of the Host's messages in the transcript. Extract the Host's personal opinions, arguments, questions, and positions on the topic. The Host's entry MUST include: their actual stance/position on the topic (not "Moderating"), at least 3-4 specific key points they raised, and a memorable quote from their messages. If the Host expressed clear opinions, reflect them accurately.
- "key_discussion_moments" MUST have at least 3 detailed entries. Each should describe a specific pivotal moment with context about who said what and why it was significant.
- "questions" MUST have at least 3 open questions with detailed "why_unresolved" explanations.
- "summary" must be substantive and detailed, not generic. Reference specific arguments by name.
- Use the EXACT participant names as provided in the participant list above.
- Every "most_memorable_quote" must be an actual or closely paraphrased quote from the transcript, not a placeholder.
"""
    try:
        text = await get_ai_response(prompt, json_mode=True, max_tokens=8192)

        # Try to extract JSON from markdown code blocks if present
        json_text = text
        if text.startswith("```"):
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
            if json_match:
                json_text = json_match.group(1)

        # Try to parse JSON, with fallback to repair common issues
        try:
            data = json.loads(json_text)
        except json.JSONDecodeError:
            # Attempt to fix common JSON issues (trailing commas, single quotes)
            cleaned = json_text.replace(',}', '}').replace(',]', ']').replace("'", '"')
            try:
                data = json.loads(cleaned)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from AI response: {json_text[:200]}")
                raise ValueError("Invalid JSON in AI response")

        # Initialize core_viewpoints before padding logic
        if not data.get("core_viewpoints"):
            data["core_viewpoints"] = []

        # Validate required fields
        if not data.get("topic"):
            data["topic"] = req.topic
        if not data.get("summary"):
            data["summary"] = ""
        if not data.get("core_viewpoints"):
            data["core_viewpoints"] = []
        if not data.get("key_discussion_moments"):
            data["key_discussion_moments"] = []
        if not data.get("questions"):
            data["questions"] = []
        if not data.get("conclusion"):
            data["conclusion"] = ""
        # Validate each core_viewpoint has most_memorable_quote
        for vp in data.get("core_viewpoints", []):
            if not vp.get("most_memorable_quote"):
                vp["most_memorable_quote"] = vp.get("key_points", [""])[0] if vp.get("key_points") else ""
        expected_count = len(req.participants) + 1  # +1 for Host
        # Validate core_viewpoints count matches participants + host
        if len(data.get("core_viewpoints", [])) != expected_count:
            existing_speakers = {vp.get("speaker") for vp in data.get("core_viewpoints", [])}
            # Pad with missing participants (not by index, but by name lookup)
            for p in req.participants:
                if p.name not in existing_speakers:
                    data["core_viewpoints"].append({
                        "speaker": p.name,
                        "title": p.title,
                        "stance": p.stance,
                        "key_points": [],
                        "most_memorable_quote": ""
                    })
            # If host is missing, add host viewpoint
            host_name = req.userContext.nickname
            if host_name not in existing_speakers:
                data["core_viewpoints"].append({
                    "speaker": host_name,
                    "title": f"Host ({req.userContext.identity})",
                    "stance": "Participated actively in the discussion",
                    "key_points": [],
                    "most_memorable_quote": ""
                })
            # If still too few, also handle any undefined/null speaker entries
            while len(data["core_viewpoints"]) < expected_count:
                data["core_viewpoints"].append({
                    "speaker": "Unknown",
                    "title": "Guest",
                    "stance": "No viewpoint recorded.",
                    "key_points": [],
                    "most_memorable_quote": ""
                })
            # Trim excess
            if len(data["core_viewpoints"]) > expected_count:
                data["core_viewpoints"] = data["core_viewpoints"][:expected_count]
        return data
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        raise ValueError(f"Summary generation failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
