import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { minimaxService } from '@/services/minimaxService';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { exportToMarkdown, exportToPDF } from '@/services/exportService';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowLeft, Users, History, Trash2, Sun, Moon, Monitor, Download, FileText } from 'lucide-react';
import type { Message, Participant } from '@/types';

import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatList } from '@/components/chat/ChatList';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ParticipantCard } from '@/components/participants/ParticipantCard';
import { DiscussionHeader } from '@/components/discussion/DiscussionHeader';
import { InputArea } from '@/components/discussion/InputArea';
import { SummaryModal } from '@/components/summary/SummaryModal';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export default function App() {
  const {
    user, setUser,
    topic, setTopic,
    appState, setAppState,
    participants, setParticipants,
    updateParticipant,
    messages, addMessage, setMessages,
    isWaitingForUser, setIsWaitingForUser,
    isStreaming, setIsStreaming, streamingText, setStreamingText,
    thinkingSpeakerId, setThinkingSpeakerId,
    openingSpeakerIndex, setOpeningSpeakerIndex,
    autoDebateCount, incrementAutoDebateCount, resetAutoDebateCount,
    currentRoundLimit, setCurrentRoundLimit,
    summary, setSummary,
    isSummarizing, setIsSummarizing,
    resetDiscussion, resetAll,
    savedDiscussions, loadSavedDiscussions, saveCurrentDiscussion,
    deleteDiscussionFromDB, loadDiscussionFromDB,
  } = useAppStore();

  const { theme, setTheme, getDelay } = useSettingsStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoScrollRef = useAutoScroll([messages, streamingText, thinkingSpeakerId]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadSavedDiscussions();
  }, [loadSavedDiscussions]);

  useKeyboardShortcuts(inputRef);

  useEffect(() => {
    if (summary && appState !== 'LANDING') {
      saveCurrentDiscussion();
    }
  }, [summary, appState, saveCurrentDiscussion]);

  const handleOnboardingComplete = useCallback((context: { nickname: string; identity: string; language: 'Chinese' | 'English' | 'Japanese' | 'Spanish' }) => {
    setUser(context);
    setAppState('LANDING');
  }, [setUser, setAppState]);

  const handleStart = useCallback(async (inputTopic: string) => {
    if (!user || !inputTopic.trim()) return;
    setTopic(inputTopic);
    setAppState('GENERATING_PANEL');

    try {
      // Timeout fallback - if generation takes too long, use fallback participants
      const timeoutPromise = new Promise<Participant[]>((resolve) => {
        setTimeout(() => resolve([
          { id: 'expert_1', name: 'Sam Altman', roleType: 'expert' as const, title: 'CEO of OpenAI', stance: 'AI will profoundly reshape human civilization', color: '#6366F1' },
          { id: 'expert_2', name: 'Yuval Noah Harari', roleType: 'expert' as const, title: 'Historian & Author', stance: 'Technology amplifies both our power and our folly', color: '#EC4899' },
          { id: 'expert_3', name: 'Fei-Fei Li', roleType: 'expert' as const, title: 'AI Researcher', stance: 'AI should be developed with human values in mind', color: '#F59E0B' },
        ]), 30000); // 30 second timeout
      });

      const newParticipants = await Promise.race([
        minimaxService.generatePanel(inputTopic, user),
        timeoutPromise,
      ]);
      setParticipants(newParticipants);
      setAppState('PANEL_REVIEW');
    } catch (error) {
      console.error('Panel generation failed:', error);
      // Use fallback participants on error
      setParticipants([
        { id: 'expert_1', name: 'Sam Altman', roleType: 'expert' as const, title: 'CEO of OpenAI', stance: 'AI will profoundly reshape human civilization', color: '#6366F1' },
        { id: 'expert_2', name: 'Yuval Noah Harari', roleType: 'expert' as const, title: 'Historian & Author', stance: 'Technology amplifies both our power and our folly', color: '#EC4899' },
        { id: 'expert_3', name: 'Fei-Fei Li', roleType: 'expert' as const, title: 'AI Researcher', stance: 'AI should be developed with human values in mind', color: '#F59E0B' },
      ]);
      setAppState('PANEL_REVIEW');
    }
  }, [user, setTopic, setAppState, setParticipants]);

  const handleConfirmPanel = useCallback(() => {
    setOpeningSpeakerIndex(0);
    setMessages([]);
    setIsWaitingForUser(false);
    resetAutoDebateCount();
    setCurrentRoundLimit(Math.floor(Math.random() * 3) + 1);
    setAppState('OPENING_STATEMENTS');
  }, [setOpeningSpeakerIndex, setMessages, setIsWaitingForUser, resetAutoDebateCount, setCurrentRoundLimit, setAppState]);

  const handleSwapParticipant = useCallback(async (id: string, newName: string) => {
    if (!user || !topic) return;
    const result = await minimaxService.generateSingleParticipant(newName, topic, user);
    updateParticipant(id, { name: result.name, title: result.title, stance: result.stance });
  }, [user, topic, updateParticipant]);

  const handleUserMessage = useCallback((text: string) => {
    const msg = { id: generateId(), senderId: 'user', text, timestamp: Date.now() };
    addMessage(msg);
    setIsWaitingForUser(false);
    resetAutoDebateCount();
    setCurrentRoundLimit(Math.floor(Math.random() * 3) + 1);
  }, [addMessage, setIsWaitingForUser, resetAutoDebateCount, setCurrentRoundLimit]);

  const handleSummarize = useCallback(async () => {
    if (!user || !topic) return;
    setIsSummarizing(true);
    const result = await minimaxService.generateSummary(topic, messages, participants, user);
    setSummary(result);
    setIsSummarizing(false);
  }, [user, topic, messages, participants, setSummary, setIsSummarizing]);

  const handleBackToHome = useCallback(async () => {
    if (messages.length > 3) {
      await saveCurrentDiscussion();
    }
    if (window.confirm('Return to home?')) {
      resetDiscussion();
    }
  }, [messages.length, saveCurrentDiscussion, resetDiscussion]);

  const handleRandomTopic = useCallback(async () => {
    if (!user) return;
    const t = await minimaxService.generateRandomTopic(user.language);
    setTopic(t);
  }, [user, setTopic]);

  const handleLoadDiscussion = useCallback(async (id: string) => {
    await loadDiscussionFromDB(id);
    setShowHistory(false);
  }, [loadDiscussionFromDB]);

  const handleDeleteDiscussion = useCallback(async (id: string) => {
    if (window.confirm('Delete this discussion?')) {
      await deleteDiscussionFromDB(id);
    }
  }, [deleteDiscussionFromDB]);

  const handleExportMarkdown = useCallback((disc: typeof savedDiscussions[0]) => {
    const markdown = exportToMarkdown(disc);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${disc.topic.slice(0, 30)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportPDF = useCallback((disc: typeof savedDiscussions[0]) => {
    exportToPDF(disc);
  }, []);

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  useEffect(() => {
    if (!user) return;

    const runOpeningStatements = async () => {
      if (appState !== 'OPENING_STATEMENTS') return;

      if (openingSpeakerIndex >= participants.length) {
        setAppState('DISCUSSION');
        setIsWaitingForUser(false); // Start auto-debate immediately
        return;
      }

      const speaker = participants[openingSpeakerIndex];
      setThinkingSpeakerId(speaker.id);

      const result = await minimaxService.generateTurnForSpeaker(
        speaker.id, topic, participants, messages, user,
        0, participants.length, true
      );

      addMessage({
        id: generateId(),
        senderId: speaker.id,
        text: result.text,
        timestamp: Date.now(),
        stance: result.stance as Message['stance'],
        stanceIntensity: result.stanceIntensity,
      });

      setThinkingSpeakerId(null);
      setOpeningSpeakerIndex(openingSpeakerIndex + 1);
    };

    const runDiscussionTurn = async () => {
      if (appState !== 'DISCUSSION') return;
      if (isWaitingForUser || isStreaming) return;

      const delay = getDelay();
      await new Promise(r => setTimeout(r, delay));

      const nextSpeakerId = await minimaxService.predictNextSpeaker(topic, participants, messages, user);
      const speaker = participants.find(p => p.id === nextSpeakerId);
      if (!speaker) return;

      setThinkingSpeakerId(nextSpeakerId);
      setIsStreaming(true, '');

      const result = await minimaxService.generateTurnForSpeaker(
        nextSpeakerId, topic, participants, messages, user,
        autoDebateCount, currentRoundLimit, false,
        (chunk) => setStreamingText(chunk)
      );

      addMessage({
        id: generateId(),
        senderId: nextSpeakerId,
        text: result.text,
        timestamp: Date.now(),
        stance: result.stance as Message['stance'],
        stanceIntensity: result.stanceIntensity,
      });

      setThinkingSpeakerId(null);
      setIsStreaming(false, '');
      setStreamingText('');

      if (result.shouldWaitForUser) {
        setIsWaitingForUser(true);
        resetAutoDebateCount();
        setCurrentRoundLimit(Math.floor(Math.random() * 3) + 1);
      } else {
        incrementAutoDebateCount();
      }
    };

    runOpeningStatements();
    runDiscussionTurn();
  }, [appState, user, participants, messages, openingSpeakerIndex, isWaitingForUser, isStreaming, autoDebateCount, currentRoundLimit, topic, getDelay]);

  const thinkingSpeaker = participants.find(p => p.id === thinkingSpeakerId);

  if (appState === 'ONBOARDING') {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <OnboardingForm onComplete={handleOnboardingComplete} />
        </div>
      </AppShell>
    );
  }

  if (appState === 'LANDING') {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">
              The Roundtable
            </h1>
            <p className="text-secondary text-lg">Assemble the greatest minds for a discussion</p>
          </motion.div>

          <Card className="w-full max-w-lg p-8">
            <textarea
              className="w-full bg-surface-elevated rounded-lg p-4 text-foreground placeholder-secondary resize-none border border-border focus:border-accent outline-none transition-colors"
              rows={3}
              placeholder="Enter your discussion topic..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <Button variant="secondary" onClick={handleRandomTopic} className="flex-1">
                <Sparkles className="w-4 h-4 mr-2" /> Random
              </Button>
              <Button onClick={() => handleStart(topic)} disabled={!topic.trim()} className="flex-1">
                <Users className="w-4 h-4 mr-2" /> Summon Guests
              </Button>
            </div>
          </Card>

          <div className="w-full max-w-lg">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-secondary hover:text-foreground transition-colors"
            >
              <History className="w-4 h-4" />
              <span>Past Discussions ({savedDiscussions.length})</span>
            </button>

            <AnimatePresence>
              {showHistory && savedDiscussions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-2 overflow-y-auto max-h-64"
                >
                  {savedDiscussions.map((disc) => (
                    <Card key={disc.id} className="p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadDiscussion(disc.id)}>
                        <p className="font-medium truncate">{disc.topic}</p>
                        <p className="text-xs text-secondary">
                          {new Date(disc.createdAt).toLocaleDateString()} · {disc.participants.length} participants
                        </p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button variant="ghost" size="icon" onClick={() => handleExportMarkdown(disc)} title="Export Markdown">
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExportPDF(disc)} title="Export PDF">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteDiscussion(disc.id)} title="Delete">
                          <Trash2 className="w-4 h-4 text-error" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="fixed top-4 right-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <ThemeIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="w-4 h-4 mr-2" /> Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="w-4 h-4 mr-2" /> Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="w-4 h-4 mr-2" /> System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </AppShell>
    );
  }

  if (appState === 'GENERATING_PANEL') {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-screen gap-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full"
          />
          <p className="text-secondary">Summoning guests...</p>
        </div>
      </AppShell>
    );
  }

  if (appState === 'PANEL_REVIEW') {
    return (
      <AppShell>
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12">
          <h2 className="text-3xl font-bold">Your Panel</h2>
          <div className="flex gap-6 flex-wrap justify-center">
            {participants.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <ParticipantCard
                  participant={p}
                  onUpdate={(id, name) => handleSwapParticipant(id, name)}
                />
              </motion.div>
            ))}
          </div>
          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => setAppState('LANDING')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={handleConfirmPanel}>
              Start the Roundtable
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col">
        <DiscussionHeader
          topic={topic}
          participants={participants}
          onBack={handleBackToHome}
        />

        <div className="flex-1 overflow-hidden flex flex-col max-w-3xl mx-auto w-full">
          <div ref={autoScrollRef} className="flex-1 overflow-y-auto px-4 py-6">
            <ChatList messages={messages} participants={participants} hostName={user?.nickname} />
            {thinkingSpeaker && (
              <div className="mt-4">
                <TypingIndicator speaker={thinkingSpeaker} />
              </div>
            )}
          </div>

          <div className="border-t border-border bg-surface/80 backdrop-blur-sm">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <InputArea
                onSendMessage={handleUserMessage}
                onSummarize={handleSummarize}
                participants={participants}
                isWaitingForUser={isWaitingForUser}
                disabled={!isWaitingForUser}
              />
            </div>
          </div>
        </div>
      </div>

      {isSummarizing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"
            />
            <p className="text-foreground">Generating summary...</p>
          </div>
        </div>
      )}

      {summary && !isSummarizing && (
        <SummaryModal
          summary={summary}
          onClose={() => setSummary(null)}
        />
      )}
    </AppShell>
  );
}
