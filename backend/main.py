import os
import random
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

# CORS - allow all origins in production (FastAPI Starlette default behavior)
# Restrict to specific origins if needed via environment variable
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MiniMax API client
api_key = os.environ.get("ANTHROPIC_API_KEY")
if not api_key:
    raise ValueError("ANTHROPIC_API_KEY environment variable is required")

MODEL = "MiniMax-M2"  # Model name for MiniMax API
MINIMAX_BASE_URL = "https://api.minimax.com/v1/messages"

# Use async httpx client to avoid blocking FastAPI's async event loop
_http_client: httpx.AsyncClient | None = None

async def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=120.0)
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
    roleType: str
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
async def get_ai_response(prompt: str, json_mode: bool = False, max_tokens: int = 1024) -> str:
    client = await get_http_client()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
    }

    data = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
        "extra_body": {"thinking_enabled": False}
    }

    if json_mode:
        data["extra_body"]["response_format"] = {"type": "json_object"}
        data["messages"] = [{"role": "user", "content": prompt.rstrip() + "\n\nRespond with ONLY valid JSON. No explanation, no markdown."}]
        # For JSON mode, use a generous token limit to avoid API issues
        data["max_tokens"] = max(4096, max_tokens)

    response = await client.post(MINIMAX_BASE_URL, json=data, headers=headers)
    response.raise_for_status()
    result = response.json()

    # Extract text from response
    content = result.get("content", [])
    for block in content:
        if block.get("type") == "text":
            text_result = block.get("text", "").strip()
            # Remove markdown code fences if present
            if text_result.startswith("```"):
                lines = text_result.split("\n")
                text_result = "\n".join(lines[1:])
                if text_result.endswith("```"):
                    text_result = text_result[:-3]
                text_result = text_result.strip()
            return text_result

    raise ValueError("AI response contained no text block and no parseable JSON in thinking")


# --- Endpoints ---
@app.post("/api/generate_random_topic")
async def generate_random_topic(req: GenerateRandomTopicRequest):
    lang_instruction = "in Chinese" if req.language.lower() == "chinese" else "in English" if req.language.lower() == "english" else f"in {req.language}"
    prompt = f"Generate a short, interesting debate topic {lang_instruction}. Make it thought-provoking and suitable for panel discussion. Respond with ONLY the topic text, no explanation."
    try:
        text = await get_ai_response(prompt, max_tokens=512)
        if not text or len(text.strip()) < 5:
            raise ValueError("Empty or too short response from AI")
        return {"topic": text.strip()}
    except Exception as e:
        print(f"Error: {e}")
        return {"topic": "Do we live in a simulation?"}


@app.post("/api/generate_panel")
async def generate_panel(req: GeneratePanelRequest):
    prompt = f"""Topic: {req.topic}
Language: {req.userContext.language}
Select 3 diverse ALIVE experts for this debate. Return JSON:
{{"participants": [{{"name": "?", "title": "?", "stance": "?"}}]}}"""
    import json
    import random
    try:
        text = await get_ai_response(prompt, json_mode=True, max_tokens=768)
        data = json.loads(text)
        participants = data.get("participants", [])
    except Exception as e:
        import traceback
        print(f"Error generating panel: {e}")
        traceback.print_exc()
        raise ValueError(f"Panel generation failed: {e}")

    # Validate: must have exactly 3 participants with required fields
    if not isinstance(participants, list) or len(participants) == 0:
        raise ValueError("Panel API returned no participants")

    # Graceful degradation: if fewer than 3, generate placeholders
    if len(participants) < 3:
        print(f"Warning: Panel API returned only {len(participants)} participant(s), padding to 3")
        default_participants = [
            {"name": "Dr. Wei Chen", "title": "AI Ethics Researcher", "stance": "Concerned about AI alignment and safety."},
            {"name": "Prof. Marcus Lee", "title": "Technology Philosopher", "stance": "Optimistic about human-AI collaboration."},
        ]
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
    prompt = f"""User: {req.inputQuery}
Topic: {req.topic}
Language: {req.userContext.language}
Identify this person. Return JSON: {{"name":"?","title":"?","stance":"?"}}"""
    try:
        text = await get_ai_response(prompt, json_mode=True, max_tokens=384)
        import json
        data = json.loads(text)
        return data
    except Exception as e:
        return {"name": req.inputQuery, "title": "Special Guest", "stance": "I have a unique perspective."}


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
    import re
    for p in req.participants:
        escaped_name = re.escape(p.name)
        pattern = rf"@{escaped_name}($|\s|[^a-zA-Z0-9])"
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

    prompt = f"""
Topic: {req.topic}
Speakers: {participants_list}
History:
{recent_history}

Task: Pick the ID of the next speaker.
Current Turn: {req.turnCount}

Rules:
1. **HOST PRIORITY**: If the Host just spoke, their question/comment is the highest priority.
{"2. **IMPLICIT CUE**: The Host just spoke after {prev_speaker.name} (ID: {prev_speaker.id}) without mentioning a name — this is an implicit cue for {prev_speaker.name} to respond, unless the Host's message is clearly asking a different specific person or is a general 'Anyone' question." if prev_speaker else "2. **DEBATE FLOW**: If no Host intervention, ensure variety. Do not let the same person speak twice in a row."}
3. **STALING**: If the debate is stalling, pick the person with the most opposing view.

Return ONLY the ID (e.g., expert_1).
"""
    try:
        text = await get_ai_response(prompt)
        speaker_id = text.strip()
        valid = next((p.id for p in req.participants if p.id == speaker_id), None)
        if valid:
            return {"speakerId": valid}
        # Safely filter out last speaker if last_message exists
        last_sender_id = last_message.senderId if last_message else None
        other_speakers = [p for p in req.participants if p.id != last_sender_id] if last_sender_id else list(req.participants)
        if other_speakers:
            return {"speakerId": random.choice(other_speakers).id}
        # Fallback: return any participant if other_speakers is empty
        return {"speakerId": req.participants[0].id}
    except Exception as e:
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
        prompt = f"""
Role: You are {speaker_name}, {speaker.title}.
Core Stance: {speaker.stance}.
Topic: "{req.topic}"
Language: {req.userContext.language}

Task: State your core argument clearly and naturally.
- Speak like a real person in a podcast/salon, not a textbook.
- Be direct but polite.
- Do not address other guests yet.
- Keep it under 50 words.
- ABSOLUTE PROHIBITION: Do NOT start with greetings like "Hello", "Hi everyone", "Good morning", "很高兴", "大家好", etc. Start directly with your substantive argument.

Output: Just the spoken text. No labels, no greetings.
"""
        try:
            text = await get_ai_response(prompt)
            if not text or len(text.strip()) < 3:
                raise ValueError("Opening statement too short or empty")
            # Reject greeting-only responses
            greeting_patterns = ["hello", "hi ", "good morning", "good afternoon", "good evening", "很高兴", "大家好", "各位好", "很高兴认识"]
            text_lower = text.strip().lower()
            if any(text_lower.startswith(g) for g in greeting_patterns):
                raise ValueError(f"Opening statement starts with greeting: {text[:30]}")
            return {"text": text.strip(), "stance": "NEUTRAL", "stanceIntensity": 3, "shouldWaitForUser": False}
        except ValueError:
            raise  # Re-raise ValueError as-is for intentional rejections
        except Exception as e:
            print(f"Opening statement error: {e}")
            raise ValueError(f"Opening statement generation failed: {e}")

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

    import random
    is_breadth_turn = not last_was_pivot and random.random() < 0.25

    strategy = "**STRATEGY: DIVERGE (Breadth)**. STOP dwelling on the current specific point. Abruptly SHIFT the lens to a NEW dimension. **MANDATORY**: Use stance 'PIVOT'." if is_breadth_turn else "**STRATEGY: CONVERGE (Depth)**. Drill deeper into the specific logic of the previous speaker."

    mentioned_in_last_host_msg = None
    if last_message and last_message.senderId == "user":
        for p in req.participants:
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
        directives = f"PRIORITY: Debate with your peers. INSTRUCTION: Address another expert from the panel. ABSOLUTE PROHIBITION: Do NOT address the Host (@{req.userContext.nickname})."

    prompt = f"""
Context: A high-quality, intellectual roundtable discussion (Salon).
Topic: "{req.topic}"
Language: {req.userContext.language}
Host: {req.userContext.nickname}
Valid Participants: {valid_names_list}

You are: {speaker_name} ({speaker.title}).
Starting Philosophy: {speaker.stance}.

Transcript (Recent Context):
{recent_history}

{directives}

ADDITIONAL RULES:
1. **INTELLECTUAL FLEXIBILITY**: Do NOT be stubbornly dogmatic. If a previous speaker makes a strong point that contradicts your view, you should ACKNOWLEDGE it.
2. **STANCE & INTENSITY**: Decide your attitude: [AGREE, DISAGREE, PARTIAL, PIVOT, NEUTRAL]. Intensity (1-5): 1=Mild, 5=Strong.
3. {strategy}
4. **STYLE**: SINGLE FOCUS, EXTREME BREVITY (under 60 words), PLAIN LANGUAGE, DIRECTNESS.

Status:
- Current Turn: {req.turnCount}/{req.maxTurns}.
- Force Yield to Host: {force_return_to_host}.

Instruction:
**OUTPUT FORMAT STRICTLY**: "STANCE||INTENSITY||MESSAGE||ACTION"

Examples:
"DISAGREE||5||I completely reject that premise because...||CONTINUE"
"AGREE||4||You have convinced me...||CONTINUE"
"PIVOT||5||That is interesting, but we are completely ignoring...||CONTINUE"

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

        should_wait = "WAIT" in action or force_return_to_host or (f"@{req.userContext.nickname}" in message and req.turnCount > 0)

        return {
            "text": message,
            "stance": stance,
            "stanceIntensity": intensity,
            "shouldWaitForUser": should_wait
        }
    except Exception as e:
        print(f"Error generating turn: {e}")
        raise ValueError(f"Discussion turn generation failed: {e}")


@app.post("/api/generate_summary")
async def generate_summary(req: GenerateSummaryRequest):
    transcript = "\n".join([
        f"{'HOST' if m.senderId == 'user' else next((p.name for p in req.participants if p.id == m.senderId), 'Unknown')}: {m.text}"
        for m in req.messageHistory
    ])

    # Build participant context for summary
    participant_context = "\n".join([
        f"- {p.name} ({p.title}): Stance on topic = {p.stance}"
        for p in req.participants
    ])

    prompt = f"""You are summarizing a high-quality intellectual roundtable discussion.

Topic: {req.topic}

Participants:
{participant_context}

Language: {req.userContext.language}

Transcript (full discussion):
{transcript}

Your task: Write a comprehensive summary in the user's language ({req.userContext.language}).

Return a JSON object with EXACTLY this structure:
{{
  "topic": "The discussion topic (1 sentence)",
  "summary": "A 3-5 sentence narrative summary of the entire discussion flow, highlighting key turning points and insights",
  "core_viewpoints": [
    {{
      "speaker": "EXACT name from the participant list above",
      "title": "their professional title",
      "stance": "their position on the topic (one sentence)",
      "key_points": ["specific point 1", "specific point 2", "specific point 3"],
      "most_memorable_quote": "a direct quote from the discussion that captures their view"
    }}
  ],
  "key_discussion_moments": [
    "Description of a significant exchange or debate point that shaped the discussion"
  ],
  "questions": [
    {{
      "question": "A thought-provoking open question that emerged from the discussion",
      "why_unresolved": "Why this question remains open or debated"
    }}
  ],
  "conclusion": "A 1-2 sentence conclusion synthesizing the overall discussion"
}}

CRITICAL REQUIREMENTS:
- "core_viewpoints" MUST have exactly {len(req.participants)} entries (one per participant). If a participant did not speak, use their known stance from the participant list.
- "key_discussion_moments" MUST have at least 2 entries.
- "questions" MUST have at least 2 open questions.
- "summary" must be substantive, not generic.
- Use the EXACT participant names as provided in the participant list above.
"""
    try:
        text = await get_ai_response(prompt, json_mode=True, max_tokens=1024)
        import json
        data = json.loads(text)
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
        # Validate core_viewpoints count matches participants
        if len(data.get("core_viewpoints", [])) != len(req.participants):
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
            # If still too few, also handle any undefined/null speaker entries
            while len(data["core_viewpoints"]) < len(req.participants):
                data["core_viewpoints"].append({
                    "speaker": "Unknown",
                    "title": "Guest",
                    "stance": "No viewpoint recorded.",
                    "key_points": [],
                    "most_memorable_quote": ""
                })
            # Trim excess
            if len(data["core_viewpoints"]) > len(req.participants):
                data["core_viewpoints"] = data["core_viewpoints"][:len(req.participants)]
        return data
    except Exception as e:
        print(f"Error generating summary: {e}")
        raise ValueError(f"Summary generation failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
