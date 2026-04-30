import { Participant, Message, RoleType, UserContext, Summary } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#84CC16'
];

// NOTE: No sharedAbortController - each apiCall manages its own timeout abort.
// External callers provide their own AbortSignal via options.signal for external cancellation.

// API call with retry support
interface ApiCallOptions {
  signal?: AbortSignal;
  retries?: number;
}

interface ParticipantResponse {
  id?: string;
  name?: string;
  title?: string;
  stance?: string;
  roleType?: string;
  color?: string;
}

async function apiCall<T>(endpoint: string, body: any, timeoutMs: number = 30000, options: ApiCallOptions = {}): Promise<T> {
  const retries = options.retries ?? 0;
  const maxAttempts = retries + 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Use external signal if provided, otherwise use the internal timeout controller.
      // The external signal (from abortControllerRef) is a clean, fresh signal created
      // per-operation by callers like handleStart. Effect cleanups no longer prematurely
      // abort the controller since effects were split to only abort on unmount.
      const signal = options.signal ?? controller.signal;
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`API error (${response.status}): ${response.statusText}`);
      }
      return response.json();
    } catch (e) {
      clearTimeout(timeoutId);
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) {
        if (options.signal?.aborted) throw lastError;
        console.warn(`API call failed (attempt ${attempt + 1}/${maxAttempts}), retrying:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError || new Error('API call failed');
}

export const generateRandomTopic = async (language: string, abortSignal?: AbortSignal): Promise<string> => {
  try {
    const res = await apiCall<{ topic: string }>('/api/generate_random_topic', { language }, 30000, { signal: abortSignal });
    return res.topic || '';
  } catch (e) {
    console.error('API call failed: generate_random_topic:', e);
    console.warn('Failed to generate random topic, using fallback:', e);
    return 'Do we live in a simulation?';
  }
};

export const generatePanel = async (topic: string, userContext: UserContext, abortSignal?: AbortSignal): Promise<Participant[]> => {
  try {
    const res = await apiCall<{ participants: ParticipantResponse[] }>('/api/generate_panel', { topic, userContext }, 30000, { signal: abortSignal });
    if (!res?.participants || !Array.isArray(res.participants) || res.participants.length < 3) {
      console.warn('Invalid panel response (missing or too few participants), using fallback');
      return getFallbackParticipants();
    }
    return res.participants.map((p: ParticipantResponse, index: number) => ({
      id: p?.id ?? `expert_${index}`,
      name: p?.name ?? 'Anonymous Expert',
      title: p?.title ?? 'Topic Specialist',
      stance: p?.stance ?? 'Neutral',
      roleType: (p?.roleType as RoleType) ?? 'expert',
      color: p?.color ?? AVATAR_COLORS[index % AVATAR_COLORS.length],
    }));
  } catch (e) {
    console.error('API call failed: generate_panel:', e);
    console.warn('Failed to generate panel, using fallback:', e);
    return getFallbackParticipants();
  }
};

function getFallbackParticipants(): Participant[] {
  return [
    { id: 'fallback_1', name: 'Dr. Sarah Chen', title: 'Ethics Professor', stance: 'Balanced', roleType: 'expert', color: '#3B82F6' },
    { id: 'fallback_2', name: 'Prof. James Wilson', title: 'Philosophy Chair', stance: 'Moderate', roleType: 'expert', color: '#10B981' },
    { id: 'fallback_3', name: 'Maria Santos', title: 'Tech Policy Analyst', stance: 'Progressive', roleType: 'expert', color: '#F97316' },
  ];
}

export const generateSingleParticipant = async (
  inputQuery: string,
  topic: string,
  userContext: UserContext,
  abortSignal?: AbortSignal
): Promise<{ name: string; title: string; stance: string }> => {
  try {
    return await apiCall<{ name: string; title: string; stance: string }>(
      '/api/generate_single_participant',
      { inputQuery, topic, userContext },
      60000,
      { signal: abortSignal }
    );
  } catch (e) {
    console.error('API call failed: generate_single_participant:', e);
    console.warn('Failed to generate single participant, using fallback:', e);
    return {
      name: inputQuery?.trim() ? inputQuery : 'Guest Speaker',
      title: 'Special Guest',
      stance: 'I have a unique perspective.'
    };
  }
};

export const predictNextSpeaker = async (
  topic: string,
  participants: Participant[],
  messageHistory: Message[],
  userContext: UserContext,
  turnCount: number,
  abortSignal?: AbortSignal
): Promise<string> => {
  try {
    const res = await apiCall<{ speakerId: string }>('/api/predict_next_speaker', {
      topic,
      participants,
      messageHistory,
      userContext,
      turnCount,
    }, 30000, { signal: abortSignal });
    return res.speakerId;
  } catch (e) {
    console.error('API call failed: predict_next_speaker:', e);
    // Fallback safely - check length before accessing element
    if (!participants?.length) {
      throw new Error('No participants available');
    }
    return participants[0].id;
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
  mentionedParticipantId?: string,
  abortSignal?: AbortSignal
): Promise<{ text: string; stance?: string; stanceIntensity?: number; shouldWaitForUser: boolean; actionDescription?: string }> => {
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
    }, 45000, { signal: abortSignal });
  } catch (e) {
    console.error('API call failed: generate_turn:', e);
    console.warn('Failed to generate turn, using fallback:', e);
    return {
      text: isOpeningStatement
        ? `As a participant in this discussion, I'm ready to explore the topic from my unique perspective.`
        : `Thank you for that perspective. I believe we should consider this from multiple angles.`,
      stance: undefined,
      stanceIntensity: undefined,
      shouldWaitForUser: true
    };
  }
};

export const generateSummary = async (
  topic: string,
  messageHistory: Message[],
  participants: Participant[],
  userContext: UserContext,
  abortSignal?: AbortSignal
): Promise<Summary> => {
  try {
    return await apiCall('/api/generate_summary', { topic, messageHistory, participants, userContext }, 90000, { signal: abortSignal });
  } catch (e) {
    console.error('API call failed: generate_summary:', e);
    console.warn('Failed to generate summary, using fallback:', e);
    const participantNames = participants?.map(p => p.name).join(', ') || 'Panel participants';
    const participantViewpoints = participants?.map(p => ({
        speaker: p.name,
        title: p.title,
        stance: p.stance,
        key_points: [],
        most_memorable_quote: ""
      })) || [];
    // Include host viewpoint
    if (userContext) {
      const hostMessages = messageHistory?.filter(m => m.senderId === 'user') || [];
      const hostKeyPoints = hostMessages.slice(0, 3).map(m => m.text.slice(0, 100) + (m.text.length > 100 ? '...' : ''));
      participantViewpoints.push({
        speaker: userContext.nickname,
        title: `Host (${userContext.identity})`,
        stance: 'Expressed views through questions and commentary',
        key_points: hostKeyPoints,
        most_memorable_quote: hostMessages.length > 0 ? hostMessages[hostMessages.length - 1].text.slice(0, 120) : ''
      });
    }
    const lastMessages = messageHistory?.slice(-3) || [];
    const summaryText = lastMessages.length > 0
      ? `Discussion covered key points about "${topic}" with contributions from ${participantNames}. Key themes emerged around the topic's implications and various perspectives were explored.`
      : `The discussion on "${topic}" explored multiple perspectives. ${participantNames} shared their insights on the topic, examining both practical and theoretical considerations.`;
    return {
      topic: topic,
      summary: summaryText,
      core_viewpoints: participantViewpoints,
      key_discussion_moments: [],
      questions: [],
      conclusion: ""
    };
  }
};
