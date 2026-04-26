import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any

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

MODEL = "MiniMax-M2.7"
MINIMAX_BASE_URL = "https://api.minimaxi.com/anthropic/v1/messages"

AVATAR_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
    '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#84CC16'
]


# --- Request/Response Models ---
class UserContext(BaseModel):
    nickname: str
    language: str


class Message(BaseModel):
    senderId: str
    text: str
    stance: Optional[str] = None


class Participant(BaseModel):
    id: str
    name: str
    title: str
    stance: str
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


class GenerateSummaryRequest(BaseModel):
    topic: str
    messageHistory: List[Message]
    participants: List[Participant]
    userContext: UserContext


# --- Helper ---
def get_ai_response(prompt: str, json_mode: bool = False) -> str:
    extra_headers = {}
    if json_mode:
        extra_headers["extra_body"] = {"response_format": {"type": "json_object"}}
        prompt = prompt + "\n\nYou must respond with valid JSON only. No markdown, no explanation."

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
    }

    data = {
        "model": MODEL,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}]
    }

    if json_mode:
        data["extra_body"] = {"response_format": {"type": "json_object"}}

    with httpx.Client(timeout=60.0) as client:
        response = client.post(MINIMAX_BASE_URL, json=data, headers=headers)
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
    return ""


# --- Endpoints ---
@app.post("/api/generate_random_topic")
def generate_random_topic(req: GenerateRandomTopicRequest):
    prompt = f"Generate a short, fun debate topic about a random idea. Language: {req.language}. One sentence only."
    try:
        text = get_ai_response(prompt)
        return {"topic": text.strip()}
    except Exception as e:
        print(f"Error: {e}")
        return {"topic": "Do we live in a simulation?"}


@app.post("/api/generate_panel")
def generate_panel(req: GeneratePanelRequest):
    prompt = f"""
You are casting a high-intellect "Roundtable" discussion.
Topic: "{req.topic}"
Language: "{req.userContext.language}"
Host: "{req.userContext.nickname}" (The User)

Generate 3 GUESTS (Experts/Figures).

**CRITICAL SELECTION RULES**:
1. **MUST BE ALIVE (Contemporary Figures)**: Do NOT select deceased historical figures unless the topic specifically mentions history or dead people. The user wants a REALISTIC modern debate.
2. **GLOBAL RELEVANCE**: Select the 3 people in the world BEST suited to discuss this specific topic, regardless of nationality.
3. **DIVERSITY**: Ensure distinct perspectives (e.g., One Tech Optimist, One Ethicist, One Skeptic).
4. **CONCISENESS**: The 'stance' MUST be a short, punchy motto or philosophy. **MAXIMUM 20 WORDS**.

Return JSON: {{ "participants": [{{ "name": "string", "title": "string", "stance": "string" }}] }}
"""
    try:
        text = get_ai_response(prompt, json_mode=True)
        print(f"DEBUG generate_panel: got text={text[:100]!r}")
        import json
        data = json.loads(text)
        participants = data.get("participants", [])
    except Exception as e:
        import traceback
        print(f"Error generating panel: {e}")
        traceback.print_exc()
        participants = [
            {"name": "Sam Altman", "title": "CEO of OpenAI", "stance": "AI will elevate humanity."},
            {"name": "Yuval Noah Harari", "title": "Historian & Author", "stance": "Algorithms may hack humans."},
            {"name": "Slavoj Žižek", "title": "Philosopher", "stance": "Ideology is in the machine."},
        ]

    import random
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
    prompt = f"""
User Input: "{req.inputQuery}"
Discussion Topic: "{req.topic}"
Language: {req.userContext.language}

Task: Identify the guest based on the User Input.
1. If the input is a specific NAME (e.g., "Elon Musk"), use that person.
2. If the input is a DESCRIPTION (e.g., "A harsh critic of AI", "A Roman Emperor", "Someone who loves Mars"), **identify the single best matching real-world figure** (Historical or Contemporary).

Return JSON:
{{
  "name": "The Actual Name of the person (e.g. Elon Musk)",
  "title": "Short Job Title (e.g. CEO of X)",
  "stance": "A single sentence opinion on the topic (Max 15 words)."
}}
"""
    try:
        text = get_ai_response(prompt, json_mode=True)
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

    # Check @Mentions
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

Output: Just the spoken text. No labels.
"""
        try:
            text = get_ai_response(prompt)
            return {"text": text.strip(), "stance": "NEUTRAL", "stanceIntensity": 3, "shouldWaitForUser": False}
        except:
            return {"text": "Hello.", "stance": "NEUTRAL", "stanceIntensity": 3, "shouldWaitForUser": False}

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

    directives = ""
    if host_just_spoke:
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
            stance = parts[0].strip().upper()
            intensity = int(parts[1].strip()) if parts[1].strip().isdigit() else 3
            message = parts[2].strip()
            action = parts[3].strip()
        elif len(parts) >= 3:
            if parts[1].strip().isdigit():
                stance = parts[0].strip().upper()
                intensity = int(parts[1].strip())
                message = parts[2].strip()
            else:
                stance = parts[0].strip().upper()
                message = parts[1].strip()
                action = parts[2].strip()
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
        return {"text": "...", "stance": "NEUTRAL", "stanceIntensity": 3, "shouldWaitForUser": True}


@app.post("/api/generate_summary")
def generate_summary(req: GenerateSummaryRequest):
    transcript = "\n".join([
        f"{'HOST' if m.senderId == 'user' else next((p.name for p in req.participants if p.id == m.senderId), 'Unknown')}: {m.text}"
        for m in req.messageHistory
    ])

    prompt = f"""
Analyze the discussion about "{req.topic}".
Language: {req.userContext.language}

Transcript:
{transcript}

Task:
1. State the Discussion Topic clearly.
2. Summarize the Core Viewpoint of EACH participant (including Host if they made points).
3. List future Open Questions.

Return JSON: {{
    "topic": "string",
    "core_viewpoints": [{{ "speaker": "string", "point": "string" }}],
    "questions": ["string"]
}}
"""
    try:
        text = get_ai_response(prompt, json_mode=True)
        import json
        data = json.loads(text)
        return data
    except Exception as e:
        return {"topic": req.topic, "core_viewpoints": [], "questions": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
