import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Message, Participant, Summary, UserContext, SavedDiscussion } from '@/types';
import { storageService } from '@/services/storageService';

interface AppStore {
  // User
  user: UserContext | null;

  // Discussion
  topic: string;
  participants: Participant[];
  messages: Message[];
  appState: AppState;

  // UI State
  isWaitingForUser: boolean;
  isStreaming: boolean;
  streamingText: string;
  thinkingSpeakerId: string | null;
  openingSpeakerIndex: number;
  autoDebateCount: number;
  currentRoundLimit: number;
  summary: Summary | null;
  isSummarizing: boolean;

  // Saved discussions
  savedDiscussions: SavedDiscussion[];

  // Actions
  setUser: (user: UserContext) => void;
  setTopic: (topic: string) => void;
  setAppState: (state: AppState) => void;
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setIsWaitingForUser: (value: boolean) => void;
  setIsStreaming: (value: boolean, text?: string) => void;
  setStreamingText: (text: string) => void;
  setThinkingSpeakerId: (id: string | null) => void;
  setOpeningSpeakerIndex: (index: number) => void;
  incrementAutoDebateCount: () => void;
  resetAutoDebateCount: () => void;
  setCurrentRoundLimit: (limit: number) => void;
  setSummary: (summary: Summary | null) => void;
  setIsSummarizing: (value: boolean) => void;
  resetDiscussion: () => void;
  addSavedDiscussion: (disc: SavedDiscussion) => void;
  removeSavedDiscussion: (id: string) => void;
  resetAll: () => void;
  // IndexedDB async actions
  loadSavedDiscussions: () => Promise<void>;
  saveCurrentDiscussion: () => Promise<void>;
  deleteDiscussionFromDB: (id: string) => Promise<void>;
  loadDiscussionFromDB: (id: string) => Promise<void>;
}

const initialState = {
  user: null,
  topic: '',
  participants: [],
  messages: [],
  appState: 'ONBOARDING' as AppState,
  isWaitingForUser: false,
  isStreaming: false,
  streamingText: '',
  thinkingSpeakerId: null,
  openingSpeakerIndex: 0,
  autoDebateCount: 0,
  currentRoundLimit: 0,
  summary: null,
  isSummarizing: false,
  savedDiscussions: [],
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => set({ user }),
      setTopic: (topic) => set({ topic }),
      setAppState: (appState) => set({ appState }),
      setParticipants: (participants) => set({ participants }),

      updateParticipant: (id, updates) => set((state) => ({
        participants: state.participants.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      })),

      addMessage: (message) => set((state) => ({
        messages: [...state.messages, message],
      })),

      setMessages: (messages) => set({ messages }),

      setIsWaitingForUser: (isWaitingForUser) => set({ isWaitingForUser }),

      setIsStreaming: (isStreaming, streamingText) => set({
        isStreaming,
        streamingText: streamingText ?? ''
      }),

      setStreamingText: (streamingText) => set({ streamingText }),

      setThinkingSpeakerId: (thinkingSpeakerId) => set({ thinkingSpeakerId }),

      setOpeningSpeakerIndex: (openingSpeakerIndex) => set({ openingSpeakerIndex }),

      incrementAutoDebateCount: () => set((state) => ({
        autoDebateCount: state.autoDebateCount + 1,
      })),

      resetAutoDebateCount: () => set({ autoDebateCount: 0 }),

      setCurrentRoundLimit: (currentRoundLimit) => set({ currentRoundLimit }),

      setSummary: (summary) => set({ summary }),

      setIsSummarizing: (isSummarizing) => set({ isSummarizing }),

      resetDiscussion: () => set({
        topic: '',
        participants: [],
        messages: [],
        appState: 'LANDING',
        isWaitingForUser: false,
        isStreaming: false,
        streamingText: '',
        thinkingSpeakerId: null,
        openingSpeakerIndex: 0,
        autoDebateCount: 0,
        currentRoundLimit: 0,
        summary: null,
        isSummarizing: false,
      }),

      addSavedDiscussion: (disc) => set((state) => ({
        savedDiscussions: [...state.savedDiscussions, disc],
      })),

      removeSavedDiscussion: (id) => set((state) => ({
        savedDiscussions: state.savedDiscussions.filter((d) => d.id !== id),
      })),

      resetAll: () => set(initialState),

      loadSavedDiscussions: async () => {
        const discussions = await storageService.listDiscussions();
        set({ savedDiscussions: discussions });
      },

      saveCurrentDiscussion: async () => {
        const state = get();
        if (!state.topic || state.participants.length === 0) return;

        const discussion: SavedDiscussion = {
          id: `disc_${Date.now()}`,
          title: state.topic.slice(0, 50),
          topic: state.topic,
          participants: state.participants,
          messages: state.messages,
          createdAt: new Date(),
          updatedAt: new Date(),
          summary: state.summary ?? undefined,
        };

        await storageService.saveDiscussion(discussion);
        const discussions = await storageService.listDiscussions();
        set({ savedDiscussions: discussions });
      },

      deleteDiscussionFromDB: async (id: string) => {
        await storageService.deleteDiscussion(id);
        const discussions = await storageService.listDiscussions();
        set({ savedDiscussions: discussions });
      },

      loadDiscussionFromDB: async (id: string) => {
        const discussion = await storageService.loadDiscussion(id);
        if (discussion) {
          set({
            topic: discussion.topic,
            participants: discussion.participants,
            messages: discussion.messages,
            summary: discussion.summary ?? null,
            appState: 'LANDING',
          });
        }
      },
    }),
    {
      name: 'roundtable-storage',
      partialize: (state) => ({
        user: state.user,
        savedDiscussions: state.savedDiscussions,
      }),
    }
  )
);
