import re
from typing import Optional
from app.models.schemas import Participant, Message, Stance, Action


SYSTEM_PROMPT = """You are hosting a lively roundtable debate between three distinct personalities.
Each speaker has a unique background and stance on the topic.

Your task is to generate a single speaker's turn based on the debate history.
Output format is STRICTLY: STANCE||INTENSITY||MESSAGE||ACTION

Where:
- STANCE: AGREE, DISAGREE, PARTIAL, PIVOT, or NEUTRAL
- INTENSITY: 1-5 (how strongly the speaker feels)
- MESSAGE: The speaker's actual words (2-4 sentences, engaging and distinct voice)
- ACTION: CONTINUE (keep debating) or WAIT (let user respond)

Rules:
- Respect each speaker's established stance and personality
- Reference other speakers' points when disagreeing
- 25% chance to PIVOT to a related but unexplored aspect
- Never break character or speak as "the debate"
"""


PANEL_SYSTEM_PROMPT = """Generate exactly 3 debate participants for the topic: {topic}

Each participant must be:
- A real, recognizable public figure with a distinct perspective on this topic
- Have a clear, defensible stance (even if controversial)
- Be someone who would actually debate this topic in real life

Output format is JSON array:
[
  {{
    "id": "participant_1",
    "name": "Full Name",
    "title": "Title/Role",
    "stance": "Core position in 5-10 words",
    "color": "#RRGGBB"
  }},
  ...
]

Requirements:
- Names must be real public figures
- Three perspectives should be meaningfully different
- Titles should be accurate
- Colors should be visually distinct"""


TOPIC_SYSTEM_PROMPT = """Generate a single debate topic that is:
- Thought-provoking and debatable
- Not too broad or too narrow
- Has at least 2 distinct valid perspectives

Output format:
{{"topic": "Is AI dangerous?", "description": "Optional brief context"}}"""


def parse_turn_response(text: str) -> tuple[Stance, int, str, Action]:
    text = text.strip()
    match = re.match(r"(AGREE|DISAGREE|PARTIAL|PIVOT|NEUTRAL)\|\|(\d)\|\|(.+)\|\|(CONTINUE|WAIT)", text, re.DOTALL)
    if not match:
        return Stance.NEUTRAL, 3, text, Action.CONTINUE
    stance = Stance(match.group(1))
    intensity = int(match.group(2))
    message = match.group(3).strip()
    action = Action(match.group(4))
    return stance, intensity, message, action


def build_history_prompt(messages: list[Message], participants: list[Participant]) -> str:
    if not messages:
        return "No previous statements. This is the opening statement."
    lines = []
    for msg in messages[-6:]:
        speaker = next((p for p in participants if p.id == msg.participantId), None)
        name = speaker.name if speaker else "Unknown"
        lines.append(f"{name}: {msg.content}")
    return "\n".join(lines)


def build_turn_messages(
    topic: str,
    participants: list[Participant],
    current_speaker: Participant,
    history: list[Message],
    turn_count: int,
) -> list[dict]:
    history_text = build_history_prompt(history, participants)
    participant_context = "\n".join(
        f"- {p.name} ({p.title}): {p.stance}" for p in participants
    )
    user_message = f"""Topic: {topic}

Participant Context:
{participant_context}

Recent Debate History:
{history_text}

Current Speaker: {current_speaker.name} ({current_speaker.title})
Stance: {current_speaker.stance}

Generate {current_speaker.name}'s response:"""
    return [{"role": "user", "content": user_message}]
