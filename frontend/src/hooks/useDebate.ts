import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { debateStart, debateTurn, fetchSummary } from '@/services/api';

// Always use fast speed (1 second delay between turns)
const DEBATE_DELAY = 1000;

export function useDebate() {
  const {
    appState,
    topic,
    participants,
    messages,
    isWaitingForUser,
    isStreaming,
    isSummarizing,
    autoDebateCount,
    mentionedId,
    setAppState,
    setIsWaitingForUser,
    setIsStreaming,
    setIsSummarizing,
    setThinkingSpeakerId,
    setMentionedId,
    addMessage,
    updateMessage,
    removeMessage,
    incrementAutoDebateCount,
    resetAutoDebateCount,
    setSummary,
    clearMessages,
  } = useAppStore();

  // Use refs to avoid dependency changes triggering re-runs
  const incrementRef = useRef(incrementAutoDebateCount);
  incrementRef.current = incrementAutoDebateCount;

  // Track if debate start is already in progress
  const debateInProgressRef = useRef(false);

  const startDebate = useCallback(async () => {
    // Prevent double-starting
    if (debateInProgressRef.current) {
      return;
    }

    const { topic: currentTopic, participants: currentParticipants } = useAppStore.getState();
    if (!currentTopic || currentParticipants.length === 0) return;

    debateInProgressRef.current = true;
    clearMessages();
    resetAutoDebateCount();
    setIsStreaming(true);

    try {
      await debateStart(currentTopic, currentParticipants, (msg, isFinal) => {
        const { messages: currentMessages } = useAppStore.getState();
        if (isFinal) {
          // Final message - remove preview if exists, then add final
          const previewId = `preview-${msg.participantId}`;
          removeMessage(previewId);
          addMessage(msg);
        } else {
          // Partial message - update or add preview
          const existingMsg = currentMessages.find(m => m.id === msg.id);
          if (existingMsg) {
            updateMessage(msg.id, msg);
          } else {
            addMessage(msg);
          }
        }
      });
      // After opening statements, increment to signal opening phase is done
      incrementRef.current();
    } catch (err) {
      console.error('Failed to start debate:', err);
    } finally {
      setIsStreaming(false);
      debateInProgressRef.current = false;
    }
  }, [clearMessages, resetAutoDebateCount, setIsStreaming, addMessage, updateMessage, removeMessage]);

  const generateNextTurn = useCallback(async () => {
    if (isStreaming) return;

    // Use getState to always get fresh values
    const { autoDebateCount: currentCount, participants: currentParticipants, messages: currentMessages, config: currentConfig, mentionedId: currentMentionedId } = useAppStore.getState();

    // If @mention was used, that person speaks next, then clear it
    let nextMentionedId: string | undefined = currentMentionedId || undefined;
    if (currentMentionedId) {
      setMentionedId(null); // Clear after reading
    }

    let currentSpeaker;
    if (nextMentionedId) {
      const mentioned = currentParticipants.find(p => p.id === nextMentionedId);
      currentSpeaker = mentioned || currentParticipants[currentCount % currentParticipants.length];
    } else {
      currentSpeaker = currentParticipants[currentCount % currentParticipants.length];
    }

    setThinkingSpeakerId(currentSpeaker.id);
    setIsStreaming(true);

    try {
      const { message, action } = await debateTurn(
        'debate-1',
        currentMessages,
        currentParticipants,
        currentCount,
        currentConfig.maxTurnsPerRound,
        nextMentionedId
      );
      addMessage(message);
      incrementRef.current();

      if (action === 'WAIT' || currentCount >= currentConfig.maxTurnsPerRound) {
        setIsWaitingForUser(true);
      }
    } catch (err) {
      console.error('Failed to generate turn:', err);
      setIsWaitingForUser(true);
    } finally {
      setThinkingSpeakerId(null);
      setIsStreaming(false);
    }
  }, [isStreaming, setThinkingSpeakerId, setIsStreaming, addMessage, setIsWaitingForUser, setMentionedId]);

  const summarize = useCallback(async () => {
    setIsSummarizing(true);
    try {
      const summary = await fetchSummary(topic, 'debate-1', messages, participants);
      setSummary(summary);
      setAppState('SUMMARY');
    } catch (err) {
      console.error('Failed to summarize:', err);
    } finally {
      setIsSummarizing(false);
    }
  }, [topic, messages, participants, setSummary, setAppState, setIsSummarizing]);

  // Auto-debate effect
  useEffect(() => {
    if (appState !== 'DEBATING') return;
    if (isWaitingForUser || isStreaming) return;
    if (autoDebateCount === 0) return; // Waiting for startDebate to complete first

    const timer = setTimeout(() => {
      generateNextTurn();
    }, DEBATE_DELAY);

    return () => clearTimeout(timer);
  }, [appState, isWaitingForUser, isStreaming, autoDebateCount, generateNextTurn]);

  return {
    startDebate,
    generateNextTurn,
    summarize,
  };
}
