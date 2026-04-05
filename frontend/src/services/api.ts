import type { Participant, Message, Summary } from '@/types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.json();
}

export async function fetchRandomTopic(): Promise<{ topic: string; description?: string }> {
  const res = await fetch(`${API_BASE}/topics/random`, { method: 'POST' });
  return handleResponse(res);
}

export async function fetchPanel(topic: string): Promise<{ participants: Participant[] }> {
  const res = await fetch(`${API_BASE}/panel/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  });
  return handleResponse(res);
}

export async function debateStart(
  topic: string,
  participants: Participant[],
  onChunk: (msg: Message) => void
): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/debate/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, participants }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const messages: Message[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.id) {
            const msg: Message = {
              id: parsed.id,
              participantId: parsed.participantId,
              content: parsed.content,
              stance: parsed.stance,
              intensity: parsed.intensity,
              timestamp: parsed.timestamp,
            };
            messages.push(msg);
            onChunk(msg);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  return messages;
}

export async function debateTurn(
  debateId: string,
  history: Message[],
  participants: Participant[],
  turnCount: number,
  maxTurns: number
): Promise<{ message: Message; action: 'CONTINUE' | 'WAIT' }> {
  const res = await fetch(`${API_BASE}/debate/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debateId, history, participants, turnCount, maxTurns }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let message: Message | null = null;
  let action: 'CONTINUE' | 'WAIT' = 'CONTINUE';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.id) {
            message = parsed;
          } else if (parsed.action) {
            action = parsed.action;
          }
        } catch {
          // Skip
        }
      }
    }
  }

  if (!message) throw new Error('No message in response');
  return {
    message: {
      id: message.id,
      participantId: message.participantId,
      content: message.content,
      stance: message.stance,
      intensity: message.intensity,
      timestamp: message.timestamp,
    },
    action,
  };
}

export async function fetchSummary(
  topic: string,
  debateId: string,
  history: Message[],
  participants: Participant[]
): Promise<Summary> {
  const res = await fetch(`${API_BASE}/debate/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, debateId, history, participants }),
  });
  return handleResponse(res);
}
