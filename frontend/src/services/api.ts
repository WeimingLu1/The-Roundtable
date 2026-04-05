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

export async function lookupParticipant(name: string, topic: string): Promise<Participant> {
  const res = await fetch(`${API_BASE}/panel/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, topic }),
  });
  return handleResponse(res);
}

export async function debateStart(
  topic: string,
  participants: Participant[],
  onChunk: (msg: Message, isFinal: boolean) => void
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
  // Track the current event type (SSE sends event: and data: on separate lines)
  let currentEvent: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        // Track the event type for the next data: line
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (currentEvent === 'partial') {
            // Partial content - update existing or create preview
            const previewMsg: Message = {
              id: parsed.id,
              participantId: parsed.participantId,
              content: parsed.content,
              stance: parsed.stance,
              intensity: parsed.intensity,
              timestamp: parsed.timestamp,
            };
            // Remove existing preview for this participant if any
            const existingIdx = messages.findIndex(m => m.id.startsWith('preview-') && m.participantId === previewMsg.participantId);
            if (existingIdx >= 0) {
              messages[existingIdx] = previewMsg;
            } else {
              messages.push(previewMsg);
            }
            onChunk(previewMsg, false);
          } else if (currentEvent === 'message') {
            // Final message
            const msg: Message = {
              id: parsed.id,
              participantId: parsed.participantId,
              content: parsed.content,
              stance: parsed.stance,
              intensity: parsed.intensity,
              timestamp: parsed.timestamp,
            };
            // Remove preview if exists
            const previewIdx = messages.findIndex(m => m.id.startsWith('preview-') && m.participantId === msg.participantId);
            if (previewIdx >= 0) {
              messages.splice(previewIdx, 1);
            }
            // Replace if exists, otherwise add
            const existingIdx = messages.findIndex(m => m.participantId === msg.participantId);
            if (existingIdx >= 0) {
              messages[existingIdx] = msg;
            } else {
              messages.push(msg);
            }
            onChunk(msg, true);
          } else if (currentEvent === 'done') {
            // Debate finished
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
  maxTurns: number,
  mentionedId?: string
): Promise<{ message: Message; action: 'CONTINUE' | 'WAIT' }> {
  const res = await fetch(`${API_BASE}/debate/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debateId, history, participants, turnCount, maxTurns, mentionedId }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let message: Message | null = null;
  let action: 'CONTINUE' | 'WAIT' = 'CONTINUE';
  let previewMessage: Message | null = null;
  let currentEvent: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (currentEvent === 'partial') {
            // Partial content update
            previewMessage = {
              id: parsed.id,
              participantId: parsed.participantId,
              content: parsed.content,
              stance: parsed.stance,
              intensity: parsed.intensity,
              timestamp: parsed.timestamp,
            };
          } else if (currentEvent === 'message') {
            message = {
              id: parsed.id,
              participantId: parsed.participantId,
              content: parsed.content,
              stance: parsed.stance,
              intensity: parsed.intensity,
              timestamp: parsed.timestamp,
            };
          } else if (currentEvent === 'done') {
            // Parse action from done event
            if (parsed.action) {
              action = parsed.action;
            }
          }
        } catch {
          // Skip
        }
      }
    }
  }

  if (!message) throw new Error('No message in response');
  return {
    message,
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
