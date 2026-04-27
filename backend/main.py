import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MiniMax API client
api_key = os.environ.get("ANTHROPIC_API_KEY")
if not api_key:
    raise ValueError("ANTHROPIC_API_KEY environment variable is required")

MODEL = "MiniMax-M2"
MINIMAX_BASE_URL = "https://api.minimaxi.com/anthropic/v1/messages"

# Reuse a single httpx client for connection pooling
http_client = httpx.Client(timeout=120.0)

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
def get_ai_response(prompt: str, json_mode: bool = False, max_tokens: int = 1024) -> str:
    import json as json_module  # Local import to avoid scope issues
    import random  # Local import to avoid scope issues
    import re  # Local import to avoid scope issues

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
        # For JSON mode, use a generous token limit instead of None to avoid API issues
        data["max_tokens"] = 4096

    response = http_client.post(MINIMAX_BASE_URL, json=data, headers=headers)
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

    # Fallback: try to extract JSON from thinking block
    for block in content:
        if block.get("type") == "thinking":
            thinking = block.get("thinking", "")
            # Look for JSON object with expected key
            match = re.search(r'\{[^{}]*\}', thinking, re.DOTALL)
            if match:
                try:
                    json_module.loads(match.group(0))
                    return match.group(0)
                except json_module.JSONDecodeError:
                    pass
    return ""


# --- Endpoints ---
@app.post("/api/generate_random_topic")
def generate_random_topic(req: GenerateRandomTopicRequest):
    lang_instruction = "in Chinese" if req.language.lower() == "chinese" else "in English" if req.language.lower() == "english" else f"in {req.language}"
    prompt = f"Generate a short, interesting debate topic {lang_instruction}. Make it thought-provoking and suitable for panel discussion. Respond with ONLY the topic text, no explanation."
    try:
        text = get_ai_response(prompt, max_tokens=512)
        if not text or len(text.strip()) < 5:
            raise ValueError("Empty or too short response from AI")
        return {"topic": text.strip()}
    except Exception as e:
        print(f"Error: {e}")
        return {"topic": "Do we live in a simulation?"}


@app.post("/api/generate_panel")
def generate_panel(req: GeneratePanelRequest):
    prompt = f"""Topic: {req.topic}
Language: {req.userContext.language}
Select 3 diverse ALIVE experts for this debate. Return JSON:
{{"participants": [{{"name": "?", "title": "?", "stance": "?"}}]}}"""
    import json
    import random
    try:
        text = get_ai_response(prompt, json_mode=True, max_tokens=768)
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
    if len(participants) < 3:
        raise ValueError(f"Panel API returned only {len(participants)} participant(s), need 3")
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
def generate_single_participant(req: GenerateSingleParticipantRequest):
    prompt = f"""User: {req.inputQuery}
Topic: {req.topic}
Language: {req.userContext.language}
Identify this person. Return JSON: {{"name":"?","title":"?","stance":"?"}}"""
    try:
        text = get_ai_response(prompt, json_mode=True, max_tokens=384)
        import json
        data = json.loads(text)
        return data
    except Exception as e:
        return {"name": req.inputQuery, "title": "Special Guest", "stance": "I have a unique perspective."}


@app.post("/api/predict_next_speaker")
def predict_next_speaker(req: PredictNextSpeakerRequest):
    last_message = req.messageHistory[-1] if req.messageHistory else None
    last_text = last_message.text if last_message else ""
    is_host_last = last_message.senderId == "user" if last_message else False

    # Guard against empty participants list
    if not req.participants:
        return {"speakerId": "user"}

    # Check @Mentions FIRST — always prioritize explicit @mentions
    for p in req.participants:
        if f"@{p.name}" in last_text:
            return {"speakerId": p.id}

    # Format participants
    participants_list = ", ".join([f"{p.name} (ID: {p.id})" for p in req.participants])
    recent_history = "\n".join([
        f"{'HOST' if m.senderId == 'user' else next((p.name for p in req.participants if p.id == m.senderId), 'Unknown')}: {m.text[:100]}..."
        for m in req.messageHistory[-8:]
    ])

    implicit_cue_prompt = ""
    if is_host_last and len(req.messageHistory) >= 2:
        prev_message = req.messageHistory[-2]
        if prev_message.senderId != "user":
            prev_speaker = next((p for p in req.participants if p.id == prev_message.senderId), None)
            if prev_speaker:
                implicit_cue_prompt = f"""
CRITICAL RULE: The HOST just spoke after {prev_speaker.name} (ID: {prev_speaker.id}) and did not explicitly mention a name.
This acts as an IMPLICIT CUE to {prev_speaker.name}.
You MUST pick {prev_speaker.id} to respond to the Host, unless the Host's message ("{last_text[:50]}...") is clearly asking a different specific person or is a general "Anyone" question.
"""

    prompt = f"""
Topic: {req.topic}
Speakers: {participants_list}
History:
{recent_history}

Task: Pick the ID of the next speaker.

Rules:
1. **HOST PRIORITY**: If the Host just spoke, their question/comment is the highest priority.
{implicit_cue_prompt}
2. **DEBATE FLOW**: If no Host intervention, ensure variety. Do not let the same person speak twice in a row.
3. **STALLING**: If the debate is stalling, pick the person with the most opposing view.

Return ONLY the ID (e.g., expert_1).
"""
    try:
        text = get_ai_response(prompt)
        speaker_id = text.strip()
        valid = next((p.id for p in req.participants if p.id == speaker_id), None)
        if valid:
            return {"speakerId": valid}
        other_speakers = [p for p in req.participants if p.id != last_message.senderId]
        if other_speakers:
            import random
            return {"speakerId": random.choice(other_speakers).id}
        # Fallback: return any participant if other_speakers is empty
        return {"speakerId": req.participants[0].id}
    except Exception as e:
        return {"speakerId": req.participants[0].id}


@app.post("/api/generate_turn")
def generate_turn(req: GenerateTurnRequest):
    speaker = next((p for p in req.participants if p.id == req.speakerId), None)
    speaker_name = speaker.name if speaker else "Unknown"
    valid_names_list = ", ".join([p.name for p in req.participants])

    if req.isOpeningStatement:
        prompt = f"""
Role: You are {speaker_name}, {speaker.title if speaker else ''}.
Core Stance: {speaker.stance if speaker else ''}.
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
            text = get_ai_response(prompt)
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
            if f"@{p.name}" in last_message.text:
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

You are: {speaker_name} ({speaker.title if speaker else ''}).
Starting Philosophy: {speaker.stance if speaker else ''}

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
        text = get_ai_response(prompt)
        raw = text.strip()
        parts = raw.split('||')

        stance = "NEUTRAL"
        intensity = 3
        message = ""
        action = ""

        if len(parts) >= 4:
            stance = parts[0].strip().upper() if parts[0] else "NEUTRAL"
            intensity = int(parts[1].strip()) if parts[1].strip().isdigit() else 3
            message = parts[2].strip() if len(parts) > 2 else ""
            action = parts[3].strip() if len(parts) > 3 else ""
        elif len(parts) == 3:
            if parts[1].strip().isdigit():
                stance = parts[0].strip().upper() if parts[0] else "NEUTRAL"
                intensity = int(parts[1].strip())
                message = parts[2].strip() if len(parts) > 2 else ""
            else:
                stance = parts[0].strip().upper() if parts[0] else "NEUTRAL"
                message = parts[1].strip() if len(parts) > 1 else ""
                action = parts[2].strip() if len(parts) > 2 else ""
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
def generate_summary(req: GenerateSummaryRequest):
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
        text = get_ai_response(prompt, json_mode=True, max_tokens=1024)
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
        return data
    except Exception as e:
        print(f"Error generating summary: {e}")
        raise ValueError(f"Summary generation failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
