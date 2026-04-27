import { Participant, Message, RoleType, UserContext, Summary } from '../types';

const API_BASE = 'http://localhost:3001';

const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#84CC16'
];

// Reuse a single AbortController for API calls
let sharedAbortController: AbortController | null = null;

async function apiCall<T>(endpoint: string, body: any, timeoutMs: number = 30000): Promise<T> {
  // Abort any previous in-flight request
  sharedAbortController?.abort();
  const controller = new AbortController();
  sharedAbortController = controller;

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal, // Now properly connected
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export const generateRandomTopic = async (language: string): Promise<string> => {
  try {
    const res = await apiCall<{ topic: string }>('/api/generate_random_topic', { language });
    return res.topic || '';
  } catch (e) {
    console.warn('Failed to generate random topic, using fallback:', e);
    return 'Do we live in a simulation?';
  }
};

export const generatePanel = async (topic: string, userContext: UserContext): Promise<Participant[]> => {
  const res = await apiCall<{ participants: any[] }>('/api/generate_panel', { topic, userContext }, 90000);
  const shuffledColors = [...AVATAR_COLORS].sort(() => 0.5 - Math.random());

  return res.participants.map((p: any, index: number) => ({
    id: `expert_${index}`,
    name: p.name,
    title: p.title,
    stance: p.stance,
    roleType: 'expert',
    color: shuffledColors[index % shuffledColors.length],
  }));
};

export const generateSingleParticipant = async (
  inputQuery: string,
  topic: string,
  userContext: UserContext
): Promise<{ name: string; title: string; stance: string }> => {
  try {
    return await apiCall<{ name: string; title: string; stance: string }>(
      '/api/generate_single_participant',
      { inputQuery, topic, userContext },
      60000
    );
  } catch (e) {
    console.warn('Failed to generate single participant, using fallback:', e);
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
  try {
    const res = await apiCall<{ speakerId: string }>('/api/predict_next_speaker', {
      topic,
      participants,
      messageHistory,
      userContext,
      turnCount,
    });
    return res.speakerId;
  } catch (e) {
    // Fallback safely - return first participant only if array is not empty
    if (participants.length > 0) {
      return participants[0].id;
    }
    throw new Error('No participants available');
  }
};

export const generateTurnForSpeaker = async (
  speakerId: string,
  topic: string,
  participants: Participant[],
  messageHistory: Message[],
  userContext: UserContext,
  turnCount: number,
  maxTurns: number,
  isOpeningStatement: boolean = false,
  mentionedParticipantId?: string
): Promise<{ text: string; stance?: string; stanceIntensity?: number; shouldWaitForUser: boolean }> => {
  try {
    return await apiCall('/api/generate_turn', {
      speakerId,
      topic,
      participants,
      messageHistory,
      userContext,
      turnCount,
      maxTurns,
      isOpeningStatement,
      mentionedParticipantId,
    }, 45000);  // 45s timeout for potentially long philosophical responses
  } catch (error) {
    console.error('Error generating turn:', error);
    throw error;
  }
};

export const generateSummary = async (
  topic: string,
  messageHistory: Message[],
  participants: Participant[],
  userContext: UserContext
): Promise<Summary> => {
  return await apiCall('/api/generate_summary', { topic, messageHistory, participants, userContext });
};
