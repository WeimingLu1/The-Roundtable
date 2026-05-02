import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { getDiscussion, appendMessages as saveMessages, DiscussionDetail as DiscDetail } from '../services/discussionService';
import { adminGetDiscussion, adminAppendMessages } from '../services/discussionService';
import { predictNextSpeaker, generateTurnForSpeaker } from '../services/geminiService';
import { ChatBubble } from './ChatBubble';
import { InputArea } from './InputArea';
import { Participant, Message, Summary } from '../types';
import { ArrowLeft, Loader2, Play } from 'lucide-react';

interface Props {
  id: string;
  adminMode?: boolean;
}

export function DiscussionDetail({ id, adminMode = false }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [discussion, setDiscussion] = useState<DiscDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingSpeakerId, setThinkingSpeakerId] = useState<string | null>(null);
  const [isWaitingForUser, setIsWaitingForUser] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoDebateCount, setAutoDebateCount] = useState(0);
  const [currentRoundLimit, setCurrentRoundLimit] = useState(3);
  const turnInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-detect admin mode: admins use admin APIs to bypass ownership checks
  const effectiveAdminMode = adminMode || (user?.is_admin === true);

  // Load discussion
  useEffect(() => {
    if (!user) return;
    const fetcher = effectiveAdminMode ? adminGetDiscussion : getDiscussion;
    fetcher(id)
      .then(d => {
        setDiscussion(d);
        setMessages(d.messages || []);
        setParticipants(d.participants || []);
        setSummary(d.summary);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, user, effectiveAdminMode]);

  // Discussion loop when continuing
  useEffect(() => {
    if (!isContinuing || isTyping || thinkingSpeakerId || turnInProgressRef.current) return;
    if (!participants.length || !discussion) return;

    const runTurn = async () => {
      if (!discussion) return;
      turnInProgressRef.current = true;
      setIsTyping(true);
      try {
        const nextSpeakerId = await predictNextSpeaker(
          discussion.topic, participants, messages, autoDebateCount,
          abortControllerRef.current?.signal
        );
        setThinkingSpeakerId(nextSpeakerId);

        const result = await generateTurnForSpeaker(
          nextSpeakerId, discussion.topic, participants, messages,
          autoDebateCount, currentRoundLimit, false, undefined,
          abortControllerRef.current?.signal
        );

        const newMessage: Message = {
          id: Date.now().toString(),
          senderId: nextSpeakerId,
          text: result.text,
          stance: result.stance,
          stanceIntensity: result.stanceIntensity,
          actionDescription: result.actionDescription,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, newMessage]);

        // Save to backend
        const saver = effectiveAdminMode ? adminAppendMessages : saveMessages;
        saver(id, [newMessage]).catch(console.error);

        if (result.shouldWaitForUser) {
          setIsWaitingForUser(true);
          setAutoDebateCount(0);
        } else {
          setAutoDebateCount(prev => prev + 1);
        }
      } catch (e) {
        console.error('Discussion turn error:', e);
        setIsWaitingForUser(true);
      } finally {
        setThinkingSpeakerId(null);
        setIsTyping(false);
        turnInProgressRef.current = false;
      }
    };

    runTurn();
  }, [isContinuing, isTyping, thinkingSpeakerId, autoDebateCount, messages.length]);

  const handleUserMessage = (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      senderId: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Save user message
    const saver = effectiveAdminMode ? adminAppendMessages : saveMessages;
    saver(id, [userMsg]).catch(console.error);

    setIsWaitingForUser(false);
    setAutoDebateCount(0);
    setCurrentRoundLimit(Math.floor(Math.random() * 5) + 1);
  };

  const handleStartContinue = () => {
    setIsContinuing(true);
    setIsWaitingForUser(true);
    abortControllerRef.current = new AbortController();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-md-surface flex items-center justify-center">
        <Loader2 className="animate-spin text-md-accent" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center p-6">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/history')} className="text-md-accent hover:underline">Back to History</button>
      </div>
    );
  }

  if (!discussion) return null;

  const hostName = effectiveAdminMode ? (discussion as any).user_name : user?.name;

  return (
    <div className="relative min-h-screen bg-md-surface">
      <header className="fixed top-0 left-0 right-0 h-16 bg-md-surface/80 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-sm z-50 border-b border-white/5">
        <button onClick={() => effectiveAdminMode ? navigate('/admin') : navigate('/history')} className="p-2 rounded-full hover:bg-white/10 text-md-primary">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <span className="text-sm font-bold text-md-primary truncate max-w-[200px] block">{discussion.topic}</span>
        </div>
        <div className="w-10" />
      </header>

      <div className="px-4 md:px-8 pt-24 pb-48 bg-md-surface">
        <div className="max-w-4xl mx-auto">
          {messages.map(msg => (
            <ChatBubble
              key={msg.id}
              message={msg}
              sender={participants.find(p => p.id === msg.senderId)}
              participants={participants}
              hostName={hostName}
            />
          ))}

          {isTyping && thinkingSpeakerId && (
            <div className="flex items-center gap-3 bg-md-surface-container px-4 py-2 rounded-full shadow-sm animate-pulse border border-white/10 mt-4">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: participants.find(p => p.id === thinkingSpeakerId)?.color || '#fff' }}></div>
              <span className="text-xs font-bold text-md-secondary">
                {participants.find(p => p.id === thinkingSpeakerId)?.name || 'Guest'} is typing...
              </span>
            </div>
          )}

          {!isContinuing && summary && (
            <div className="mt-8 bg-md-surface-container rounded-2xl p-6 border border-white/5">
              <h3 className="font-bold text-lg text-md-primary mb-4">Summary</h3>
              <p className="text-md-secondary text-sm leading-relaxed mb-4">{summary.summary}</p>
              {summary.conclusion && (
                <p className="text-md-primary text-sm italic">{summary.conclusion}</p>
              )}
              <button onClick={handleStartContinue}
                className="mt-6 flex items-center gap-2 px-6 py-3 bg-md-accent text-black rounded-full font-medium text-sm hover:opacity-90">
                <Play size={16} fill="currentColor" /> Continue Discussion
              </button>
            </div>
          )}

          {!isContinuing && !summary && (
            <div className="mt-8 text-center">
              <button onClick={handleStartContinue}
                className="flex items-center gap-2 mx-auto px-6 py-3 bg-md-accent text-black rounded-full font-medium hover:opacity-90">
                <Play size={16} fill="currentColor" /> Continue Discussion
              </button>
            </div>
          )}
        </div>
      </div>

      {isContinuing && (
        <InputArea
          onSendMessage={handleUserMessage}
          onSummarize={async () => {}}
          isDiscussing={true}
          isWaitingForUser={isWaitingForUser}
          participants={participants}
          disabled={!isWaitingForUser}
        />
      )}
    </div>
  );
}
