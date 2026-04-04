import type { Participant, Message } from '@/types';

// --- Prompt Templates ---

export const generateRandomTopic = (language: string) => `Generate a single, fun, and interdisciplinary debate topic.
Language: ${language}

Guidelines:
- Cross-over: Mix two unrelated fields if possible (e.g., Cooking & Philosophy, Biology & Architecture).
- Simple: Use simple words. Short sentence.
- Fun/Brainy: Not too heavy/dark.
- Examples: "Is mathematics discovered or invented?", "Should art be beautiful or disturbing?"

Output: ONE sentence only. No quotes.`;

export const generatePanel = (topic: string, nickname: string, language: string) => `You are casting a high-intellect "Roundtable" discussion.
Topic: "${topic}"
Language: "${language}"
Host: "${nickname}"

Generate 3 GUESTS (Experts/Figures).

CRITICAL SELECTION RULES:
1. MUST BE ALIVE (Contemporary Figures): Do NOT select deceased historical figures.
2. GLOBAL RELEVANCE: Select the 3 people BEST suited to discuss this topic.
3. DIVERSITY: Ensure distinct perspectives.
4. CONCISENESS: The 'stance' MUST be a short motto. MAXIMUM 20 WORDS.

Return JSON: { participants: [{ name, title, stance }] }`;

export const generateSingleParticipant = (inputQuery: string, topic: string, language: string) => `User Input: "${inputQuery}"
Discussion Topic: "${topic}"
Language: ${language}

Task: Identify the guest based on User Input.
Output JSON: { "name": "Actual Name", "title": "Short Job Title", "stance": "One sentence on topic (Max 15 words)" }`;

export const predictNextSpeaker = (
  topic: string,
  participants: Participant[],
  messageHistory: Message[],
  nickname: string
) => {
  const participantsList = participants.map(p => `${p.id}: ${p.name} (${p.title}) - stance: ${p.stance}`).join('\n');
  const recentHistory = messageHistory.slice(-6).map(m => {
    const sender = m.senderId === 'user' ? nickname : participants.find(p => p.id === m.senderId)?.name || 'Unknown';
    return `${sender}: ${m.text.substring(0, 100)}`;
  }).join('\n');

  const lastMessage = messageHistory[messageHistory.length - 1];
  const prevMessage = messageHistory[messageHistory.length - 2];
  const prevSpeaker = prevMessage ? participants.find(p => p.id === prevMessage.senderId) : null;

  let implicitCuePrompt = '';
  if (lastMessage?.senderId === 'user' && prevSpeaker) {
    implicitCuePrompt = `CRITICAL RULE: The HOST just spoke after ${prevSpeaker.name} and did not explicitly mention a name.
This acts as an IMPLICIT CUE to ${prevSpeaker.name}.
You MUST pick ${prevSpeaker.id} to respond, unless the Host's message is clearly asking a different person.`;
  }

  return `Topic: ${topic}
Speakers: ${participantsList}
History:
${recentHistory}

Task: Pick the ID of the next speaker.
Rules:
1. HOST PRIORITY: If the Host just spoke, their question/comment is highest priority.
${implicitCuePrompt}
2. DEBATE FLOW: No one can speak twice in a row.
3. STALLING: If debate is stalling, pick the person with the most opposing view.

Return ONLY the ID (e.g., expert_1).`;
};

export const generateTurnForSpeaker = (
  speakerName: string,
  speakerTitle: string,
  speakerStance: string,
  topic: string,
  recentHistory: string,
  isOpeningStatement: boolean,
  forceReturnToHost: boolean,
  nickname: string,
  language: string,
  lastStance?: string,
  turnCount?: number
) => {
  const lastWasPivot = lastStance === 'PIVOT';
  let isBreadthTurn = false;
  if (lastWasPivot) {
    isBreadthTurn = false;
  } else {
    isBreadthTurn = Math.random() < 0.25;
  }

  const strategyPrompt = isBreadthTurn
    ? `STRATEGY: DIVERGE (Breadth). STOP dwelling on the current point. Abruptly SHIFT to a NEW dimension (e.g., Ethics -> Economics). **MANDATORY**: Use stance 'PIVOT'.`
    : `STRATEGY: CONVERGE (Depth). Drill deeper into the specific logic of the previous speaker. Challenge or Support their specific premise.`;

  if (isOpeningStatement) {
    return `Role: You are ${speakerName}, ${speakerTitle}.
Core Stance: ${speakerStance}
Topic: "${topic}"
Language: ${language}

Task: State your core argument clearly and naturally.
- Speak like a real person in a podcast/salon.
- Be direct but polite.
- Do not address other guests yet.
- Keep it under 50 words.

Output: Just the spoken text. No labels.`;
  }

  let directives = '';
  if (forceReturnToHost) {
    directives = `You MUST cue the Host (@${nickname}) with a specific OPEN-ENDED QUESTION`;
  } else {
    directives = `Address another expert from the panel to challenge or expand. Do NOT address the Host (@${nickname}).`;
  }

  return `Context: A high-quality roundtable discussion (Salon).
Topic: "${topic}"
Language: ${language}
Host: ${nickname}

You are: ${speakerName} (${speakerTitle}).
Starting Philosophy: ${speakerStance}

Transcript (Recent Context):
${recentHistory}

${directives}

ADDITIONAL RULES:
1. INTELLECTUAL FLEXIBILITY: Do NOT be stubbornly dogmatic. If a previous speaker makes a strong point that contradicts your view, you should ACKNOWLEDGE it. It is encouraged to be PERSUADED or CHANGE YOUR MIND.
2. STANCE & INTENSITY: Decide your attitude: [AGREE, DISAGREE, PARTIAL, PIVOT, NEUTRAL]. Intensity 1-5 (1=Mild, 5=Absolute).
3. ${strategyPrompt}
4. STYLE: SINGLE FOCUS, EXTREME BREVITY (under 60 words), PLAIN LANGUAGE, DIRECTNESS.

Output STRICTLY format: "STANCE||INTENSITY||MESSAGE||ACTION"

Examples:
"DISAGREE||5||I reject that premise because...||CONTINUE"
"AGREE||4||You've convinced me...||CONTINUE"
"PIVOT||5||We are ignoring the Economic impact...||CONTINUE"

Action is "WAIT" if force yielding, otherwise "CONTINUE".`;
};

export const generateSummary = (topic: string, transcript: string, participants: Participant[], nickname: string, language: string) => `Analyze the discussion about "${topic}".
Language: ${language}

Transcript:
${transcript}

Task:
1. State the Discussion Topic clearly.
2. Summarize the Core Viewpoint of EACH participant.
3. List future Open Questions.

Return JSON: { "topic": "string", "core_viewpoints": [{ "speaker": "string", "point": "string" }], "questions": ["string"] }`;

// --- Parsing Utilities ---

export function parseTurnResponse(text: string): { stance: string; intensity: number; message: string; action: string } {
  const parts = text.split('||');
  return {
    stance: (parts[0] || 'NEUTRAL').trim(),
    intensity: parseInt(parts[1]) || 3,
    message: (parts[2] || '').trim(),
    action: (parts[3] || 'CONTINUE').trim().toUpperCase(),
  };
}

// Re-export as object for minimaxService compatibility
export const promptTemplates = {
  generateRandomTopic,
  generatePanel,
  generateSingleParticipant,
  predictNextSpeaker,
  generateTurn: generateTurnForSpeaker,
  generateSummary,
};
