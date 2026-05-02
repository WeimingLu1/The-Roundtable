import { Participant, Message, Summary } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001';

function getToken(): string | null {
  return localStorage.getItem('roundtable_token');
}

async function apiCall<T>(method: string, path: string, body?: any): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface DiscussionSummary {
  id: string;
  user_id?: string;
  topic: string;
  participants: Participant[];
  message_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

export interface DiscussionDetail extends DiscussionSummary {
  messages: Message[];
  summary: Summary | null;
}

export async function createDiscussion(topic: string, participants: Participant[]): Promise<DiscussionSummary> {
  return apiCall('POST', '/api/discussions', { topic, participants });
}

export async function listDiscussions(): Promise<DiscussionSummary[]> {
  const data = await apiCall<{ discussions: DiscussionSummary[] }>('GET', '/api/discussions');
  return data.discussions;
}

export async function getDiscussion(id: string): Promise<DiscussionDetail> {
  return apiCall('GET', `/api/discussions/${id}`);
}

export async function appendMessages(discussionId: string, messages: Message[]): Promise<{ message_count: number }> {
  return apiCall('POST', `/api/discussions/${discussionId}/messages`, { messages });
}

export async function updateDiscussion(discussionId: string, data: { summary?: Summary; status?: string }): Promise<DiscussionSummary> {
  return apiCall('PUT', `/api/discussions/${discussionId}`, data);
}

export async function archiveDiscussion(discussionId: string): Promise<void> {
  return apiCall('DELETE', `/api/discussions/${discussionId}`);
}

// Admin endpoints
export async function adminListDiscussions(search: string = ''): Promise<DiscussionSummary[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await apiCall<{ discussions: DiscussionSummary[] }>('GET', `/api/admin/discussions${params}`);
  return data.discussions;
}

export async function adminGetDiscussion(id: string): Promise<DiscussionDetail & { user_name: string; user_email: string }> {
  return apiCall('GET', `/api/admin/discussions/${id}`);
}

export async function adminAppendMessages(discussionId: string, messages: Message[]): Promise<{ message_count: number }> {
  return apiCall('POST', `/api/admin/discussions/${discussionId}/messages`, { messages });
}

export async function adminUpdateDiscussion(discussionId: string, data: { summary?: Summary; status?: string }): Promise<DiscussionSummary> {
  return apiCall('PUT', `/api/admin/discussions/${discussionId}`, data);
}
