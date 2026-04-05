import { GoogleGenAI, Type } from "@google/genai";
import { Participant, Message, RoleType, UserContext, Summary } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Reverted to Flash for all operations to prioritize cost savings
const MODEL_FAST = 'gemini-3-flash-preview';
const MODEL_SMART = 'gemini-3-flash-preview';

const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#84CC16'
];

export const generateRandomTopic = async (language: string): Promise<string> => {
  // Updated Prompt: Simpler, Cross-disciplinary, Less "Heavy"
  const prompt = `
    Generate a single, fun, and interdisciplinary debate topic.
    Language: ${language}.
    
    Guidelines:
    - **Cross-over**: Mix two unrelated fields if possible (e.g., Cooking & Philosophy, Biology & Architecture).
    - **Simple**: Use simple words. Short sentence.
    - **Fun/Brainy**: Not too heavy/dark. Not just "Ethics of AI".
    - **Examples**:
      - "Is mathematics discovered or invented?"
      - "Should art be beautiful or disturbing?"
      - "If animals could talk, which one would be the rudest?"
    
    Output: ONE sentence only. No quotes.
  `;
  
  try {
    const response = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: prompt,
    });
    return response.text?.trim() || "";
  } catch (e) {
    return "Do we live in a simulation?";
  }
};

export const generatePanel = async (topic: string, userContext: UserContext): Promise<Participant[]> => {
  const { language, nickname } = userContext;

  const prompt = `
    You are casting a high-intellect "Roundtable" discussion.
    Topic: "${topic}"
    Language: "${language}"
    Host: "${nickname}" (The User)
    
    Generate 3 GUESTS (Experts/Figures).
    
    **CRITICAL SELECTION RULES**:
    1. **MUST BE ALIVE (Contemporary Figures)**: Do NOT select deceased historical figures unless the topic specifically mentions history or dead people. The user wants a REALISTIC modern debate.
    2. **GLOBAL RELEVANCE**: Select the 3 people in the world BEST suited to discuss this specific topic, regardless of nationality.
    3. **DIVERSITY**: Ensure distinct perspectives (e.g., One Tech Optimist, One Ethicist, One Skeptic).
    4. **CONCISENESS**: The 'stance' MUST be a short, punchy motto or philosophy. **MAXIMUM 20 WORDS**.
    
    Return JSON: { participants: [{ name, title, stance }] }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_SMART, 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            participants: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  title: { type: Type.STRING },
                  stance: { type: Type.STRING, description: "Max 20 words summary of their view." },
                },
                required: ['name', 'title', 'stance']
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || '{"participants": []}');
    
    // Shuffle colors to ensure uniqueness for current participants but variety across sessions
    const shuffledColors = [...AVATAR_COLORS].sort(() => 0.5 - Math.random());

    return data.participants.map((p: any, index: number) => ({
      ...p,
      id: `expert_${index}`,
      roleType: 'expert',
      // Assign distinct color from shuffled list
      color: shuffledColors[index % shuffledColors.length],
    }));

  } catch (error) {
    console.error("Error generating panel:", error);
    return [
      { id: 'expert_0', name: 'Sam Altman', roleType: 'expert', title: 'CEO of OpenAI', stance: 'AI will elevate humanity.', color: '#EF4444' },
      { id: 'expert_1', name: 'Yuval Noah Harari', roleType: 'expert', title: 'Historian & Author', stance: 'Algorithms may hack humans.', color: '#3B82F6' },
      { id: 'expert_2', name: 'Slavoj Žižek', roleType: 'expert', title: 'Philosopher', stance: 'Ideology is in the machine.', color: '#10B981' },
    ];
  }
};

export const generateSingleParticipant = async (inputQuery: string, topic: string, userContext: UserContext): Promise<{ name: string, title: string, stance: string }> => {
  const { language } = userContext;
  
  const prompt = `
    User Input: "${inputQuery}"
    Discussion Topic: "${topic}"
    Language: ${language}
    
    Task: Identify the guest based on the User Input.
    1. If the input is a specific NAME (e.g., "Elon Musk"), use that person.
    2. If the input is a DESCRIPTION (e.g., "A harsh critic of AI", "A Roman Emperor", "Someone who loves Mars"), **identify the single best matching real-world figure** (Historical or Contemporary).
    
    Output JSON:
    { 
      "name": "The Actual Name of the person (e.g. Elon Musk)",
      "title": "Short Job Title (e.g. CEO of X)", 
      "stance": "A single sentence opinion on the topic (Max 15 words)." 
    }
  `;

  try {
    // Use FAST model for swaps to prevent UI freeze
    const response = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The resolved real name of the person" },
                    title: { type: Type.STRING },
                    stance: { type: Type.STRING }
                },
                required: ['name', 'title', 'stance']
            }
        }
    });
    
    const data = JSON.parse(response.text || '{}');
    return {
        name: data.name || inputQuery, // Fallback to input if logic fails
        title: data.title || 'Guest Speaker',
        stance: data.stance || 'Ready to discuss.'
    };
  } catch (e) {
    return { name: inputQuery, title: 'Special Guest', stance: 'I have a unique perspective.' };
  }
};

export const predictNextSpeaker = async (
  topic: string,
  participants: Participant[],
  messageHistory: Message[],
  userContext: UserContext,
  turnCount: number
): Promise<string> => {
    const lastMessage = messageHistory[messageHistory.length - 1];
    const lastText = lastMessage?.text || '';
    const isHostLast = lastMessage?.senderId === 'user';

    // 1. Check for @Mentions in the last message
    const mentionedName = participants.find(p => lastText.includes(`@${p.name}`));
    if (mentionedName) {
        return mentionedName.id;
    }

    // 2. Formatting History
    const participantsList = participants.map(p => `${p.name} (ID: ${p.id})`).join(', ');
    const recentHistory = messageHistory.slice(-8).map(m => {
        const name = m.senderId === 'user' ? 'HOST' : participants.find(p => p.id === m.senderId)?.name;
        return `${name}: ${m.text.substring(0, 100)}...`;
    }).join('\n');

    // 3. Implicit Cue Logic (Host speaks without mention -> Target Previous Speaker)
    let implicitCuePrompt = "";
    if (isHostLast) {
        const prevMessage = messageHistory[messageHistory.length - 2];
        if (prevMessage && prevMessage.senderId !== 'user') {
             const prevSpeaker = participants.find(p => p.id === prevMessage.senderId);
             if (prevSpeaker) {
                 implicitCuePrompt = `
                 CRITICAL RULE: The HOST just spoke after ${prevSpeaker.name} (ID: ${prevSpeaker.id}) and did not explicitly mention a name.
                 This acts as an IMPLICIT CUE to ${prevSpeaker.name}. 
                 You MUST pick ${prevSpeaker.id} to respond to the Host, unless the Host's message ("${lastText.substring(0, 50)}...") is clearly asking a different specific person or is a general "Anyone" question.
                 `;
             }
        }
    }

    const prompt = `
        Topic: ${topic}
        Speakers: ${participantsList}
        History:
        ${recentHistory}
        
        Task: Pick the ID of the next speaker.
        
        Rules:
        1. **HOST PRIORITY**: If the Host just spoke, their question/comment is the highest priority.
        ${implicitCuePrompt}
        2. **DEBATE FLOW**: If no Host intervention, ensure variety. Do not let the same person speak twice in a row.
        3. **STALLING**: If the debate is stalling, pick the person with the most opposing view.
        
        Return ONLY the ID (e.g., expert_1).
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
        });
        const id = response.text?.trim();
        const validId = participants.find(p => p.id === id)?.id;
        if (validId) return validId;
        
        const otherSpeakers = participants.filter(p => p.id !== lastMessage?.senderId);
        return otherSpeakers[Math.floor(Math.random() * otherSpeakers.length)].id;
    } catch (e) {
        return participants[0].id;
    }
}

export const generateTurnForSpeaker = async (
  speakerId: string,
  topic: string,
  participants: Participant[],
  messageHistory: Message[],
  userContext: UserContext,
  turnCount: number,
  maxTurns: number,
  isOpeningStatement: boolean = false
): Promise<{ text: string, stance?: string, stanceIntensity?: number, shouldWaitForUser: boolean }> => {
  const { nickname, language } = userContext;
  const speaker = participants.find(p => p.id === speakerId);
  const speakerName = speaker?.name || 'Unknown';
  
  // List of valid names for strict checking
  const validNamesList = participants.map(p => p.name).join(', ');

  // -- OPENING STATEMENT --
  if (isOpeningStatement) {
      const prompt = `
        Role: You are ${speakerName}, ${speaker?.title}.
        Core Stance: ${speaker?.stance}.
        Topic: "${topic}"
        Language: ${language}
        
        Task: State your core argument clearly and naturally.
        - Speak like a real person in a podcast/salon, not a textbook.
        - Be direct but polite.
        - Do not address other guests yet.
        - Keep it under 50 words.
        
        Output: Just the spoken text. No labels.
      `;
      try {
          const r = await ai.models.generateContent({ model: MODEL_SMART, contents: prompt });
          return { text: r.text?.trim() || "I am ready.", shouldWaitForUser: false, stance: 'NEUTRAL', stanceIntensity: 3 };
      } catch (e) { return { text: "Hello.", shouldWaitForUser: false, stance: 'NEUTRAL', stanceIntensity: 3 }; }
  }

  // -- DISCUSSION TURN --
  // Use larger context window (15) to ensure relevance
  const recentHistory = messageHistory.slice(-15).map(m => {
    const senderName = m.senderId === 'user' ? `${nickname} (HOST)` : participants.find(p => p.id === m.senderId)?.name || 'Unknown';
    return `${senderName}: ${m.text}`;
  }).join('\n\n');

  const forceReturnToHost = turnCount >= maxTurns;

  // Check Host Context
  const lastMessage = messageHistory[messageHistory.length - 1];
  const hostJustSpoke = lastMessage?.senderId === 'user';
  
  // --- ANTI-CLUSTER PIVOT LOGIC ---
  // If the previous speaker PIVOTED, we MUST discuss that new point (Converge).
  // We cannot have two pivots in a row.
  const lastWasPivot = lastMessage?.stance === 'PIVOT';

  let isBreadthTurn = false;
  if (lastWasPivot) {
      // FORCE CONVERGENCE: Discuss the new topic raised by the previous speaker
      isBreadthTurn = false;
  } else {
      // Normal state: Small chance (25%) to diverge
      isBreadthTurn = Math.random() < 0.25;
  }
  
  const strategyPrompt = isBreadthTurn
    ? `**STRATEGY: DIVERGE (Breadth)**. STOP dwelling on the current specific point. Abruptly SHIFT the lens to a NEW dimension (e.g., from Ethics -> Economics, Past -> Future). **MANDATORY**: Use stance 'PIVOT'.`
    : `**STRATEGY: CONVERGE (Depth)**. Drill deeper into the specific logic of the previous speaker. Challenge or Support their specific premise.`;

  let directives = "";

  if (hostJustSpoke) {
     directives = `
     PRIORITY: The Host (@${nickname}) just spoke: "${lastMessage.text}".
     INSTRUCTION: Answer the Host directly. Do not pivot to others yet.
     `;
  } else if (forceReturnToHost) {
     directives = `
     PRIORITY: This is the end of the current debate round.
     INSTRUCTION: You MUST cue the Host (@${nickname}) with a specific OPEN-ENDED QUESTION to guide the next phase.
     禁止: Do not cue other experts. You must address @${nickname}.
     `;
  } else {
     directives = `
     PRIORITY: Debate with your peers.
     INSTRUCTION: Address another expert from the panel to challenge or expand on their point.
     ABSOLUTE PROHIBITION: Do NOT address the Host (@${nickname}). Do NOT ask the Host for their opinion yet. We are in the middle of a debate round.
     `;
  }

  const prompt = `
    Context: A high-quality, intellectual roundtable discussion (Salon).
    Topic: "${topic}"
    Language: ${language}
    Host: ${nickname}
    Valid Participants: ${validNamesList}
    
    You are: ${speakerName} (${speaker?.title}).
    Starting Philosophy: ${speaker?.stance}
    
    Transcript (Recent Context):
    ${recentHistory}
    
    ${directives}
    
    ADDITIONAL RULES:
    1. **INTELLECTUAL FLEXIBILITY (IMPORTANT)**:
       - **Do NOT be stubbornly dogmatic.**
       - You are a thinker, not a robot. If a previous speaker (or the Host) makes a strong, logical point that contradicts your initial view, **you should ACKNOWLEDGE it**.
       - It is encouraged to be **PERSUADED**, **COMPROMISE**, or **CHANGE YOUR MIND**.
       - If you change your view, use 'AGREE' or 'PIVOT' and explain why the new logic won you over.
    
    2. **STANCE & INTENSITY**:
       - Explicitly decide your attitude toward the previous point: [AGREE, DISAGREE, PARTIAL, PIVOT, NEUTRAL].
       - Decide Intensity (1-5): 1=Mild/Uncertain, 5=Absolute/Strong.
       - If Disagreeing: Counter-argue with logic.
       - **PIVOT RULE**: If instructed to DIVERGE, you MUST use 'PIVOT' and ensure the new angle is clearly distinct.
    
    3. ${strategyPrompt}
    
    4. **STYLE (STRICT)**:
       - **SINGLE FOCUS**: Express EXACTLY ONE core idea.
       - **EXTREME BREVITY**: Keep it under 60 words. No fluff.
       - **PLAIN LANGUAGE**: Speak like a person, not a book.
       - **DIRECTNESS**: Start with your conclusion immediately.
    
    Mechanics:
    - **STRICT @MENTIONING**: Use exact names from "Valid Participants".
    - If "Force Yield" is FALSE, you are FORBIDDEN from tagging @${nickname}.
    
    Status:
    - Current Turn: ${turnCount}/${maxTurns}.
    - Force Yield to Host: ${forceReturnToHost}.
    
    Instruction:
    **OUTPUT FORMAT STRICTLY**: "STANCE||INTENSITY||MESSAGE||ACTION"
    
    Examples:
    "DISAGREE||5||I completely reject that premise because...||CONTINUE"
    "AGREE||4||You have convinced me. Your logic regarding X is undeniable...||CONTINUE"
    "PIVOT||5||That is interesting, but we are completely ignoring the Economic impact...||CONTINUE"
    
    Action is "WAIT" if force yielding, otherwise "CONTINUE".
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_SMART, 
      contents: prompt,
    });

    const raw = response.text?.trim() || "";
    const parts = raw.split('||');
    
    let stance = 'NEUTRAL';
    let intensity = 3;
    let text = '';
    let action = '';

    if (parts.length >= 4) {
        stance = parts[0].trim().toUpperCase();
        intensity = parseInt(parts[1].trim()) || 3;
        text = parts[2].trim();
        action = parts[3].trim();
    } else if (parts.length >= 3) {
        const potentialIntensity = parseInt(parts[1].trim());
        if (!isNaN(potentialIntensity)) {
             stance = parts[0].trim().toUpperCase();
             intensity = potentialIntensity;
             text = parts[2].trim();
        } else {
             stance = parts[0].trim().toUpperCase();
             text = parts[1].trim();
             action = parts[2].trim();
        }
    } else {
        text = raw;
    }

    text = text.replace(/^TEXT[:\s]*/i, '');
    
    let shouldWaitForUser = false;
    
    if (action.includes('WAIT')) shouldWaitForUser = true;
    else if (forceReturnToHost) shouldWaitForUser = true;
    else if (text.includes(`@${nickname}`)) {
        if (turnCount > 0) shouldWaitForUser = true; 
    }

    return { text, stance, stanceIntensity: intensity, shouldWaitForUser };

  } catch (error) {
    return { text: "...", stance: "NEUTRAL", stanceIntensity: 3, shouldWaitForUser: true };
  }
};

export const generateSummary = async (topic: string, messageHistory: Message[], participants: Participant[], userContext: UserContext): Promise<Summary> => {
    const { language } = userContext;
    const transcript = messageHistory.map(m => {
        const name = m.senderId === 'user' ? 'HOST' : participants.find(p => p.id === m.senderId)?.name;
        return `${name}: ${m.text}`;
    }).join('\n');

    const prompt = `
    Analyze the discussion about "${topic}".
    Language: ${language}
    
    Transcript:
    ${transcript}
    
    Task:
    1. State the Discussion Topic clearly.
    2. Summarize the Core Viewpoint of EACH participant (including Host if they made points).
    3. List future Open Questions.
    
    Return JSON: { 
        "topic": "string", 
        "core_viewpoints": [ { "speaker": "string", "point": "string" } ], 
        "questions": ["string"] 
    }
    `;
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const data = JSON.parse(response.text || '{}');
        return { 
            topic: data.topic || topic,
            core_viewpoints: data.core_viewpoints || [], 
            questions: data.questions || [] 
        };
    } catch (e) {
        return { topic: topic, core_viewpoints: [], questions: [] };
    }
};