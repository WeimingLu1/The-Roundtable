import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { debateStart, debateTurn, fetchSummary } from '@/services/api';

const getDelay = (speed: 'slow' | 'normal' | 'fast'): number => {
  switch (speed) {
    case 'slow': return 4000;
    case 'fast': return 1000;
    default: return 2000;
  }
};

export function useDebate() {
  const {
    appState,
    topic,
    participants,
    messages,
    config,
    isWaitingForUser,
    isStreaming,
    autoDebateCount,
    setAppState,
    setIsWaitingForUser,
    setIsStreaming,
    setThinkingSpeakerId,
    addMessage,
    incrementAutoDebateCount,
    resetAutoDebateCount,
    setSummary,
    clearMessages,
  } = useAppStore();

  const startDebate = useCallback(async () => {
    if (!topic || participants.length === 0) return;

    clearMessages();
    resetAutoDebateCount();
    setIsStreaming(true);

    try {
      await debateStart(topic, participants, (msg) => {
        addMessage(msg);
      });
    } catch (err) {
      console.error('Failed to start debate:', err);
    } finally {
      setIsStreaming(false);
    }
  }, [topic, participants, clearMessages, resetAutoDebateCount, setIsStreaming, addMessage]);

  const generateNextTurn = useCallback(async () => {
    if (isStreaming) return;

    const currentSpeaker = participants[autoDebateCount % participants.length];
    setThinkingSpeakerId(currentSpeaker.id);
    setIsStreaming(true);

    try {
      const { message, action } = await debateTurn(
        'debate-1',
        messages,
        participants,
        autoDebateCount,
        config.maxTurnsPerRound
      );
      addMessage(message);
      incrementAutoDebateCount();

      if (action === 'WAIT' || autoDebateCount >= config.maxTurnsPerRound) {
        setIsWaitingForUser(true);
      }
    } catch (err) {
      console.error('Failed to generate turn:', err);
      setIsWaitingForUser(true);
    } finally {
      setThinkingSpeakerId(null);
      setIsStreaming(false);
    }
  }, [
    isStreaming,
    participants,
    autoDebateCount,
    messages,
    config.maxTurnsPerRound,
    setThinkingSpeakerId,
    setIsStreaming,
    addMessage,
    incrementAutoDebateCount,
    setIsWaitingForUser,
  ]);

  const summarize = useCallback(async () => {
    try {
      const summary = await fetchSummary('debate-1', messages, participants);
      setSummary(summary);
      setAppState('SUMMARY');
    } catch (err) {
      console.error('Failed to summarize:', err);
    }
  }, [messages, participants, setSummary, setAppState]);

  // Auto-debate effect
  useEffect(() => {
    if (appState !== 'DEBATING') return;
    if (isWaitingForUser || isStreaming) return;
    if (autoDebateCount === 0) return; // Waiting for startDebate to complete first

    const delay = getDelay(config.speed);
    const timer = setTimeout(() => {
      generateNextTurn();
    }, delay);

    return () => clearTimeout(timer);
  }, [appState, isWaitingForUser, isStreaming, autoDebateCount, config.speed, generateNextTurn]);

  return {
    startDebate,
    generateNextTurn,
    summarize,
  };
}
