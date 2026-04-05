import { create } from 'zustand';
import type {
  AppState,
  Participant,
  Message,
  Summary,
  DebateConfig,
} from '@/types';

interface AppStore {
  // App state
  appState: AppState;
  setAppState: (state: AppState) => void;

  // User
  userName: string;
  setUserName: (name: string) => void;

  // Topic
  topic: string;
  setTopic: (topic: string) => void;

  // Participants
  participants: Participant[];
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;

  // Messages
  messages: Message[];
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;

  // Debate control
  isWaitingForUser: boolean;
  setIsWaitingForUser: (waiting: boolean) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  isSummarizing: boolean;
  setIsSummarizing: (summarizing: boolean) => void;
  thinkingSpeakerId: string | null;
  setThinkingSpeakerId: (id: string | null) => void;
  autoDebateCount: number;
  incrementAutoDebateCount: () => void;
  resetAutoDebateCount: () => void;
  mentionedId: string | null;
  setMentionedId: (id: string | null) => void;

  // Config
  config: DebateConfig;
  setConfig: (config: Partial<DebateConfig>) => void;

  // Summary
  summary: Summary | null;
  setSummary: (summary: Summary | null) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  appState: 'ONBOARDING' as AppState,
  userName: '',
  topic: '',
  participants: [] as Participant[],
  messages: [] as Message[],
  isWaitingForUser: false,
  isStreaming: false,
  isSummarizing: false,
  thinkingSpeakerId: null as string | null,
  autoDebateCount: 0,
  config: { speed: 'normal' as const, maxTurnsPerRound: 3 },
  summary: null as Summary | null,
  mentionedId: null as string | null,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setAppState: (appState) => set({ appState }),

  setUserName: (userName) => set({ userName }),

  setTopic: (topic) => set({ topic }),

  setParticipants: (participants) => set({ participants }),

  updateParticipant: (id, updates) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),

  clearMessages: () => set({ messages: [] }),

  setIsWaitingForUser: (isWaitingForUser) => set({ isWaitingForUser }),

  setIsStreaming: (isStreaming) => set({ isStreaming }),

  setIsSummarizing: (isSummarizing) => set({ isSummarizing }),

  setThinkingSpeakerId: (thinkingSpeakerId) => set({ thinkingSpeakerId }),

  incrementAutoDebateCount: () =>
    set((state) => ({ autoDebateCount: state.autoDebateCount + 1 })),

  resetAutoDebateCount: () => set({ autoDebateCount: 0 }),

  setMentionedId: (mentionedId) => set({ mentionedId }),

  setConfig: (config) =>
    set((state) => ({ config: { ...state.config, ...config } })),

  setSummary: (summary) => set({ summary }),

  reset: () => set(initialState),
}));
