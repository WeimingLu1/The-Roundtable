import re
from typing import Optional
from app.models.schemas import Participant, Message, Stance, Action


SYSTEM_PROMPT = """你正在主持一场活跃的圆桌讨论，三位嘉宾围绕主题展开辩论。
每位发言者都有独特的背景和立场。

你的任务是根据辩论历史生成一位发言者的发言。
输出格式必须严格遵循，不要包含任何其他文字：

AGREE||强度||发言内容||CONTINUE
或
DISAGREE||强度||发言内容||CONTINUE
或
PARTIAL||强度||发言内容||CONTINUE
或
NEUTRAL||强度||发言内容||CONTINUE
或
PIVOT||强度||发言内容||CONTINUE

如果想让用户参与，使用WAIT而不是CONTINUE。

格式说明：
- 立场: AGREE(同意)、DISAGREE(反对)、PARTIAL(部分同意)、PIVOT(转向)、NEUTRAL(中立)
- 强度: 1-5的数字（表示发言者的强烈程度）
- 发言内容: 发言者的实际话语（2-4句话，有吸引力的独特声音，用中文）
- 动作: CONTINUE(继续辩论)或WAIT(等待用户回复)

规则：
- 尊重每位发言者已建立的立场和性格
- 反驳其他发言者的观点时要有理有据
- 20%概率转向相关但未探索的方面
- 不要跳出角色或以"辩论"的身份发言
- 所有发言内容必须使用中文
- 不要在发言内容中包含立场、强度等格式字符，只输出纯文本
"""


PANEL_SYSTEM_PROMPT = """为以下主题生成3位辩论参与者，所有内容必须使用中文：{topic}

每位参与者必须：
- 是真实存在的中国公众人物对话题有独特见解
- 有明确、有争议但站得住脚的立场
- 是真正会在现实中辩论此话题的人

输出格式为JSON数组，所有内容必须是中文：
[
  {{
    "id": "participant_1",
    "name": "真实中文全名",
    "title": "真实的中文职位/角色",
    "stance": "核心立场（5-10个字的中文）",
    "color": "#RRGGBB"
  }},
  ...
]

要求：
- 必须是真实的中国公众人物
- 三种观点要有实质性差异
- 头衔要准确，用中文
- 颜色要有视觉区分度
- 姓名和头衔必须是中文"""


TOPIC_SYSTEM_PROMPT = """生成一个辩论主题，要求：
- 引人深思且可辩论
- 不要太宽泛或太狭窄
- 至少有2个不同视角
- 所有输出必须使用中文

输出格式（必须是中文）：
{{"topic": "中文主题内容", "description": "简要背景介绍（可选）"}}"""


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
