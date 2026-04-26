import { Participant, Message, RoleType, UserContext, Summary } from '../types';

const API_BASE = 'http://localhost:3001';

const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#84CC16'
];

async function apiCall<T>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
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
  try {
    const res = await apiCall<{ participants: any[] }>('/api/generate_panel', { topic, userContext });
    const shuffledColors = [...AVATAR_COLORS].sort(() => 0.5 - Math.random());

    return res.participants.map((p: any, index: number) => ({
      id: `expert_${index}`,
      name: p.name,
      title: p.title,
      stance: p.stance,
      roleType: 'expert',
      color: shuffledColors[index % shuffledColors.length],
    }));
  } catch (error) {
    console.error('Error generating panel:', error);
    return [
      { id: 'expert_0', name: 'Sam Altman', roleType: 'expert', title: 'CEO of OpenAI', stance: 'AI will elevate humanity.', color: '#EF4444' },
      { id: 'expert_1', name: 'Yuval Noah Harari', roleType: 'expert', title: 'Historian & Author', stance: 'Algorithms may hack humans.', color: '#3B82F6' },
      { id: 'expert_2', name: 'Slavoj Žižek', roleType: 'expert', title: 'Philosopher', stance: 'Ideology is in the machine.', color: '#10B981' },
    ];
  }
};

export const generateSingleParticipant = async (
  inputQuery: string,
  topic: string,
  userContext: UserContext
): Promise<{ name: string; title: string; stance: string }> => {
  try {
    return await apiCall<{ name: string; title: string; stance: string }>(
      '/api/generate_single_participant',
      { inputQuery, topic, userContext }
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
  isOpeningStatement: boolean = false
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
    });
  } catch (error) {
    console.error('Error generating turn:', error);
    return { text: '...', stance: 'NEUTRAL', stanceIntensity: 3, shouldWaitForUser: true };
  }
};

export const generateSummary = async (
  topic: string,
  messageHistory: Message[],
  participants: Participant[],
  userContext: UserContext
): Promise<Summary> => {
  try {
    return await apiCall('/api/generate_summary', { topic, messageHistory, participants, userContext });
  } catch (e) {
    return { topic, core_viewpoints: [], questions: [] };
  }
};
