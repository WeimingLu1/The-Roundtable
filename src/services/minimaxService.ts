import type { Participant, Message, UserContext, Summary } from '@/types';
import { generateRandomTopic, generatePanel, generateSingleParticipant, predictNextSpeaker, generateTurnForSpeaker, generateSummary, parseTurnResponse } from './promptTemplates';

const API_BASE = '/api';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Strip thinking tags from Minimax responses
function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<thinking>[\s\S]*$/gi, '')
    .trim();
}

const FALLBACK_PARTICIPANTS: Participant[] = [
  { id: 'expert_1', name: 'Sam Altman', roleType: 'expert', title: 'CEO of OpenAI', stance: 'AI will profoundly reshape human civilization', color: '#6366F1' },
  { id: 'expert_2', name: 'Yuval Noah Harari', roleType: 'expert', title: 'Historian & Author', stance: 'Technology amplifies both our power and our folly', color: '#EC4899' },
  { id: 'expert_3', name: 'Slavoj Zizek', roleType: 'expert', title: 'Philosopher', stance: 'Ideology masks the contradictions of capital', color: '#F59E0B' },
];

const FALLBACK_TOPIC = 'Do we live in a simulation?';

const FALLBACK_SUMMARY: Summary = {
  topic: '',
  core_viewpoints: [],
  questions: [],
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function chat(messages: ChatMessage[], maxTokens = 256): Promise<string> {
  console.log('minimaxService.chat called, messages:', messages?.length);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    console.log('minimaxService.chat got response, status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Proxy error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('minimaxService.chat parsed JSON, data keys:', Object.keys(data));
    const content = data.choices?.[0]?.message?.content || '';
    console.log('minimaxService.chat content:', content.substring(0, 200));
    return content;
  } catch (e) {
    clearTimeout(timeoutId);
    if ((e as Error).name === 'AbortError') {
      console.error('minimaxService.chat timeout');
      throw new Error('Request timeout');
    }
    throw e;
  }
}

export const minimaxService = {
  async generateRandomTopic(language: string): Promise<string> {
    try {
      const prompt = generateRandomTopic(language);
      const text = await chat([{ role: 'user', content: prompt }], 100);
      return stripThinking(text).trim() || FALLBACK_TOPIC;
    } catch (e) {
      console.error('generateRandomTopic error:', e);
      return FALLBACK_TOPIC;
    }
  },

  async generatePanel(topic: string, userContext: UserContext): Promise<Participant[]> {
    try {
      const prompt = generatePanel(topic, userContext.nickname, userContext.language);
      const text = await chat([{ role: 'user', content: prompt }], 256);
      console.log('generatePanel raw response:', text.substring(0, 500));

      const participantsMatch = text.match(/"participants"\s*:\s*\[[\s\S]*?\]/);
      if (participantsMatch) {
        const json = JSON.parse('{' + participantsMatch[0] + '}');
        const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'];
        if (json.participants && Array.isArray(json.participants)) {
          return json.participants.map((p: any, i: number) => ({
            id: `expert_${i + 1}`,
            name: p.name,
            roleType: 'expert' as const,
            title: p.title,
            stance: p.stance,
            color: colors[i % colors.length],
          }));
        }
      }

      const match = text.match(/\{[\s\S]*?\}/);
      if (match) {
        try {
          const json = JSON.parse(match[0]);
          if (json.participants) {
            const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'];
            return json.participants.map((p: any, i: number) => ({
              id: `expert_${i + 1}`,
              name: p.name,
              roleType: 'expert' as const,
              title: p.title,
              stance: p.stance,
              color: colors[i % colors.length],
            }));
          }
        } catch {
          // JSON parse failed
        }
      }
    } catch (e) {
      console.error('generatePanel error:', e);
    }
    return FALLBACK_PARTICIPANTS;
  },

  async generateSingleParticipant(inputQuery: string, topic: string, userContext: UserContext): Promise<{ name: string; title: string; stance: string }> {
    try {
      const prompt = generateSingleParticipant(inputQuery, topic, userContext.language);
      const text = await chat([{ role: 'user', content: prompt }], 200);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(stripThinking(match[0]));
      }
    } catch (e) {
      console.error('generateSingleParticipant error:', e);
    }
    return { name: inputQuery, title: 'Special Guest', stance: 'An interesting perspective' };
  },

  async predictNextSpeaker(
    topic: string,
    participants: Participant[],
    messageHistory: Message[],
    userContext: UserContext
  ): Promise<string> {
    try {
      const prompt = predictNextSpeaker(topic, participants, messageHistory, userContext.nickname);
      const text = await chat([{ role: 'user', content: prompt }], 50);
      const cleanText = stripThinking(text);
      const match = cleanText.match(/(expert_\d+)/);
      if (match) return match[1];
      const found = participants.find(p => cleanText.includes(p.name));
      if (found) return found.id;
    } catch (e) {
      console.error('predictNextSpeaker error:', e);
    }

    const lastSender = messageHistory[messageHistory.length - 1]?.senderId;
    const available = participants.filter(p => p.id !== lastSender);
    return available[Math.floor(Math.random() * available.length)]?.id || participants[0]?.id || 'expert_1';
  },

  async generateTurnForSpeaker(
    speakerId: string,
    topic: string,
    participants: Participant[],
    messageHistory: Message[],
    userContext: UserContext,
    turnCount: number,
    maxTurns: number,
    isOpeningStatement: boolean = false,
    onChunk?: (text: string) => void
  ): Promise<{ text: string; stance?: string; stanceIntensity?: number; shouldWaitForUser: boolean }> {
    const speaker = participants.find(p => p.id === speakerId);
    if (!speaker) {
      return { text: '...', shouldWaitForUser: true };
    }

    const recentHistory = messageHistory.slice(-8).map(m => {
      const sender = m.senderId === 'user' ? userContext.nickname : participants.find(p => p.id === m.senderId)?.name || 'Unknown';
      return `${sender}: ${m.text}`;
    }).join('\n');

    const lastMessage = messageHistory[messageHistory.length - 1];
    const lastStance = lastMessage?.stance;
    const forceReturnToHost = turnCount >= maxTurns - 1;

    try {
      const prompt = generateTurnForSpeaker(
        speaker.name,
        speaker.title,
        speaker.stance,
        topic,
        recentHistory,
        isOpeningStatement,
        forceReturnToHost,
        userContext.nickname,
        userContext.language,
        lastStance,
        turnCount
      );

      const fullText = await chat([{ role: 'user', content: prompt }], 256);
      const cleanText = stripThinking(fullText);

      if (isOpeningStatement) {
        return { text: cleanText || '...', shouldWaitForUser: false };
      }

      const parsed = parseTurnResponse(cleanText);
      const shouldWait = parsed.action === 'WAIT' || forceReturnToHost;

      return {
        text: parsed.message || cleanText,
        stance: parsed.stance,
        stanceIntensity: parsed.intensity,
        shouldWaitForUser: shouldWait,
      };
    } catch (e) {
      console.error('generateTurnForSpeaker error:', e);
      return { text: '...', shouldWaitForUser: true };
    }
  },

  async generateSummary(
    topic: string,
    messageHistory: Message[],
    participants: Participant[],
    userContext: UserContext
  ): Promise<Summary> {
    try {
      const transcript = messageHistory.map(m => {
        const sender = m.senderId === 'user' ? userContext.nickname : participants.find(p => p.id === m.senderId)?.name || 'Unknown';
        return `${sender}: ${m.text}`;
      }).join('\n');

      const prompt = generateSummary(topic, transcript, participants, userContext.nickname, userContext.language);
      const text = await chat([{ role: 'user', content: prompt }], 256);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(stripThinking(match[0]));
      }
    } catch (e) {
      console.error('generateSummary error:', e);
    }
    return FALLBACK_SUMMARY;
  },
};
