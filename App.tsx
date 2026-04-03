import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Participant, Message, AppState, Summary, UserContext } from './types';
import { generatePanel, predictNextSpeaker, generateTurnForSpeaker, generateSummary, generateRandomTopic, generateSingleParticipant } from './services/geminiService';
import { ParticipantCard } from './components/ParticipantCard';
import { ChatBubble } from './components/ChatBubble';
import { InputArea } from './components/InputArea';
import { SummaryModal } from './components/SummaryModal';
import { OnboardingForm } from './components/OnboardingForm';
import { ArrowRight, RotateCcw, Loader2, Play, ChevronLeft } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.ONBOARDING);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [topic, setTopic] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // States
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingSpeakerId, setThinkingSpeakerId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isLoadingTopic, setIsLoadingTopic] = useState(false);
  const [updatingParticipantId, setUpdatingParticipantId] = useState<string | null>(null);
  
  const [isWaitingForUser, setIsWaitingForUser] = useState(false); 
  
  // Logic Control
  const [autoDebateCount, setAutoDebateCount] = useState(0);
  const [currentRoundLimit, setCurrentRoundLimit] = useState(3);
  const [openingSpeakerIndex, setOpeningSpeakerIndex] = useState(0); 
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, thinkingSpeakerId, isTyping, isWaitingForUser]);

  // --- DISCUSSION LOOP ---
  useEffect(() => {
    if (isWaitingForUser || isSummarizing) return;

    // 1. OPENING STATEMENTS PHASE
    if (appState === AppState.OPENING_STATEMENTS) {
        if (isTyping || thinkingSpeakerId) return;

        if (openingSpeakerIndex < participants.length) {
            const speaker = participants[openingSpeakerIndex];
            setThinkingSpeakerId(speaker.id);
            setIsTyping(true);

            // EXECUTE IMMEDIATELY (No Timeout)
            (async () => {
                 const result = await generateTurnForSpeaker(
                    speaker.id, 
                    topic, 
                    participants, 
                    messages, 
                    userContext!, 
                    0, 0, true 
                );
                 const newMessage: Message = {
                    id: Date.now().toString(),
                    senderId: speaker.id,
                    text: result.text,
                    stance: result.stance, // Capture stance
                    stanceIntensity: result.stanceIntensity, // Capture intensity
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, newMessage]);
                setThinkingSpeakerId(null);
                setIsTyping(false);
                setOpeningSpeakerIndex(prev => prev + 1);
            })();
        } else {
            // All openings done, switch to normal discussion and give control to host
            setAppState(AppState.DISCUSSION);
            setIsWaitingForUser(true); 
        }
        return;
    }

    // 2. NORMAL DISCUSSION PHASE
    if (appState === AppState.DISCUSSION) {
        if (isTyping || thinkingSpeakerId) return;

        const processNextTurn = async () => {
            const nextSpeakerId = await predictNextSpeaker(topic, participants, messages, userContext!, autoDebateCount);
            
            setThinkingSpeakerId(nextSpeakerId);
            setIsTyping(true);

            const result = await generateTurnForSpeaker(
                nextSpeakerId, 
                topic, 
                participants, 
                messages, 
                userContext!,
                autoDebateCount,
                currentRoundLimit,
                false
            );
            
            const newMessage: Message = {
                id: Date.now().toString(),
                senderId: nextSpeakerId,
                text: result.text,
                stance: result.stance, // Capture stance
                stanceIntensity: result.stanceIntensity, // Capture intensity
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, newMessage]);
            setThinkingSpeakerId(null);
            setIsTyping(false);
            
            if (result.shouldWaitForUser) {
                setIsWaitingForUser(true);
                setAutoDebateCount(0);
            } else {
                setAutoDebateCount(prev => prev + 1);
            }
        };

        // EXECUTE IMMEDIATELY (No Timeout)
        processNextTurn();
    }
  }, [messages, appState, isWaitingForUser, openingSpeakerIndex, participants, isSummarizing, autoDebateCount]);


  // --- HANDLERS ---

  const handleOnboardingComplete = (context: UserContext) => {
    setUserContext(context);
    setAppState(AppState.LANDING);
  };

  const handleStart = async () => {
    if (!topic.trim() || !userContext) return;
    setAppState(AppState.GENERATING_PANEL);
    const panel = await generatePanel(topic, userContext);
    setParticipants(panel);
    setAppState(AppState.PANEL_REVIEW);
  };

  const handleUpdateParticipantName = (id: string, newName: string) => {
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  };
  
  const handleSwapParticipant = async (id: string, inputQuery: string) => {
      if (!userContext) return;
      setUpdatingParticipantId(id);
      
      try {
          // Add a promise race with timeout to prevent hanging forever
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 8000)
          );
          
          // Pass the inputQuery (which might be a name or description)
          const apiPromise = generateSingleParticipant(inputQuery, topic, userContext);
          
          // @ts-ignore
          const details = await Promise.race([apiPromise, timeoutPromise]);
          
          // @ts-ignore
          if (!details) throw new Error("No details");

          setParticipants(prev => prev.map(p => {
              if (p.id === id) {
                  return {
                      ...p,
                      // Use the name returned by AI (which resolves descriptions like "sci-fi writer" to "Isaac Asimov")
                      // Fallback to inputQuery if empty (unlikely)
                      // @ts-ignore
                      name: details.name || inputQuery,
                      // @ts-ignore
                      title: details.title || 'Special Guest',
                      // @ts-ignore
                      stance: details.stance || 'Ready to discuss.',
                  };
              }
              return p;
          }));
      } catch (error) {
          console.error("Failed to swap participant", error);
          // Fallback update even if AI fails, so user isn't stuck. Use raw input here.
          setParticipants(prev => prev.map(p => p.id === id ? { ...p, name: inputQuery, title: 'Guest', stance: 'Ready.' } : p));
      } finally {
          setUpdatingParticipantId(null);
      }
  };

  const handleConfirmPanel = () => {
    setAppState(AppState.OPENING_STATEMENTS);
    setOpeningSpeakerIndex(0);
    setMessages([]);
  };

  const handleUserMessage = (text: string) => {
    const userMsg: Message = {
        id: Date.now().toString(),
        senderId: 'user',
        text: text,
        timestamp: Date.now(),
        isInterruption: false 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsWaitingForUser(false);
    setAutoDebateCount(0); 
    // Randomly assign 1-3 turns (reduced from 1-5) before returning to host
    setCurrentRoundLimit(Math.floor(Math.random() * 3) + 1); 
  };

  const handleSummarize = async () => {
      if (!userContext) return;
      setIsSummarizing(true);
      try {
        const s = await generateSummary(topic, messages, participants, userContext);
        setSummary(s);
      } finally {
        setIsSummarizing(false);
      }
  };

  const handleBackToHome = () => {
      if (window.confirm("End the current roundtable discussion?")) {
          setAppState(AppState.LANDING);
          setMessages([]);
          setParticipants([]);
          setTopic('');
          setIsWaitingForUser(false);
          setSummary(null);
      }
  };

  const handleRandomTopic = async () => {
      if (!userContext || isLoadingTopic) return;
      setIsLoadingTopic(true);
      try {
          const newTopic = await generateRandomTopic(userContext.language);
          setTopic(newTopic);
      } finally {
          setIsLoadingTopic(false);
      }
  }

  // --- VIEWS ---

  if (appState === AppState.ONBOARDING) {
    return <OnboardingForm onComplete={handleOnboardingComplete} />;
  }

  if (appState === AppState.LANDING) {
    return (
      <div className="min-h-screen bg-md-surface flex flex-col items-center p-6 text-center animate-fade-in relative">
        {/* Fixed Back Button */}
        <div className="fixed top-6 left-6 z-50">
             <button 
                onClick={() => setAppState(AppState.ONBOARDING)}
                className="p-2 rounded-full bg-md-surface-container hover:bg-white/10 transition-colors border border-white/5 text-md-primary shadow-sm backdrop-blur-md"
                title="Back to Setup"
            >
                <ChevronLeft size={24} />
            </button>
         </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mt-12">
            <h1 className="font-sans text-5xl md:text-6xl font-bold text-md-primary mb-4 tracking-tight">The Roundtable</h1>
            <p className="text-md-secondary text-lg mb-12">Assemble the world's greatest minds.</p>
            
            <div className="w-full">
                <div className="mb-8 flex items-center justify-between bg-md-surface-container px-6 py-4 rounded-2xl shadow-sm border border-white/5">
                    <div className="text-left">
                        <p className="text-xs font-bold text-md-outline uppercase tracking-wider">Host</p>
                        <p className="text-lg font-bold text-md-primary">{userContext?.nickname}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-md-outline uppercase tracking-wider">Lang</p>
                        <p className="text-sm text-md-secondary">{userContext?.language}</p>
                    </div>
                </div>

            <label className="block text-left text-sm font-bold text-md-secondary mb-2 ml-1">
                Topic of Debate
            </label>
            <div className="relative">
                <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full bg-md-surface-container border-none rounded-2xl p-6 text-xl shadow-elevation-1 focus:ring-2 focus:ring-md-accent/50 outline-none transition-all resize-none text-md-primary placeholder-gray-500"
                    rows={3}
                    placeholder={userContext?.language === 'Chinese' ? "例如：人工智能是否拥有意识？" : "e.g. Is universal basic income necessary?"}
                />
                <button 
                    onClick={handleRandomTopic}
                    disabled={isLoadingTopic}
                    className="absolute bottom-4 right-4 text-xs bg-md-surface-container-low px-3 py-1 rounded-full text-md-secondary hover:bg-md-accent hover:text-black transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                >
                    {isLoadingTopic && <Loader2 size={12} className="animate-spin" />}
                    {isLoadingTopic ? 'Thinking...' : 'Random Idea'}
                </button>
            </div>
            
            <button 
                onClick={handleStart}
                // Updated check: trim() ensures whitespace doesn't enable it, and prevents disabled look when valid text exists
                disabled={!topic.trim() || isLoadingTopic}
                className="mt-8 w-full bg-md-accent text-black font-medium py-4 text-lg rounded-full shadow-elevation-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
                Summon Guests <ArrowRight size={20} />
            </button>
            </div>
        </div>
      </div>
    );
  }

  if (appState === AppState.GENERATING_PANEL) {
    return (
      <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center relative">
         <div className="fixed top-6 left-6 z-50">
             <button 
                onClick={() => setAppState(AppState.LANDING)}
                className="p-2 rounded-full bg-md-surface-container hover:bg-white/10 transition-colors border border-white/5 text-md-primary shadow-sm backdrop-blur-md"
            >
                <ChevronLeft size={24} />
            </button>
         </div>
         <div className="relative">
             <div className="absolute inset-0 bg-md-accent/20 rounded-full animate-ping opacity-75"></div>
             <div className="relative bg-md-surface-container p-6 rounded-full shadow-elevation-2 border border-white/10">
                 <Loader2 className="animate-spin text-md-accent" size={40} />
             </div>
         </div>
         <p className="text-xl text-md-secondary mt-8 animate-pulse font-medium">Gathering the experts...</p>
      </div>
    );
  }

  if (appState === AppState.PANEL_REVIEW) {
    return (
      <div className="min-h-screen bg-md-surface flex flex-col animate-fade-in">
        <header className="sticky top-0 z-50 bg-md-surface/90 backdrop-blur-md px-6 py-6 flex items-center border-b border-white/5 shadow-sm">
             <button onClick={() => setAppState(AppState.LANDING)} className="p-2 rounded-full bg-md-surface-container hover:bg-white/10 transition-colors">
                <ChevronLeft size={24} className="text-md-primary"/>
             </button>
             <span className="ml-4 text-lg font-bold text-md-primary">Guest List</span>
        </header>

        <div className="px-8 max-w-5xl mx-auto w-full text-center mt-6">
            <h2 className="text-3xl font-bold text-md-primary tracking-tight">The Table is Set</h2>
            <p className="text-md-secondary mt-2">Tap 'Invite New Guest' to customize the panel.</p>
        </div>

        <div className="flex-1 flex flex-col justify-center">
            {/* Scroll Container for Cards */}
            <div className="overflow-x-auto flex items-center gap-4 px-8 py-8 snap-x snap-mandatory max-w-7xl mx-auto no-scrollbar w-full">
                {participants.map(p => (
                    <ParticipantCard 
                        key={p.id} 
                        participant={p} 
                        onUpdate={handleUpdateParticipantName}
                        onReplace={handleSwapParticipant}
                        isUpdating={updatingParticipantId === p.id}
                    />
                ))}
            </div>
        </div>

        <div className="p-8 pb-12 bg-md-surface-container rounded-t-[40px] shadow-elevation-3 border-t border-white/5">
            <div className="max-w-md mx-auto space-y-3">
                <button 
                    onClick={handleConfirmPanel}
                    disabled={!!updatingParticipantId}
                    className="w-full bg-md-accent text-black text-xl font-medium py-4 rounded-full shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                   {updatingParticipantId ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
                   {updatingParticipantId ? 'Preparing Guest...' : 'Start Roundtable'}
                </button>
                <button 
                    onClick={() => handleStart()} 
                    disabled={!!updatingParticipantId}
                    className="w-full text-md-secondary text-sm font-medium py-3 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <RotateCcw size={16} /> Reshuffle All
                </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-md-surface">
      {/* Header - Fixed to top */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-md-surface/80 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-sm z-50 border-b border-white/5 transition-all duration-300">
        <button onClick={handleBackToHome} className="p-2 rounded-full hover:bg-white/10 text-md-primary">
            <ChevronLeft size={24} />
        </button>

        <div className="flex -space-x-3">
            {participants.map(p => (
                <div 
                    key={p.id} 
                    className="w-8 h-8 rounded-full border-2 border-md-surface flex items-center justify-center text-[10px] font-bold text-white"
                    style={{backgroundColor: p.color}}
                >
                    {p.name[0]}
                </div>
            ))}
        </div>
        <div className="w-10"></div> {/* Spacer for center alignment */}
      </header>

      {/* Chat Area - Allow natural window scroll, with padding for fixed elements */}
      <div className="px-4 md:px-8 pt-24 pb-48 bg-md-surface">
        <div className="max-w-4xl mx-auto">
            {/* Opening Intro Text */}
            {appState === AppState.OPENING_STATEMENTS && (
                 <div className="text-center mb-8 animate-fade-in">
                    <span className="bg-md-surface-container px-4 py-2 rounded-full text-xs font-bold text-md-secondary shadow-sm uppercase tracking-widest border border-white/10">
                        Opening Statements
                    </span>
                 </div>
            )}
            
            {messages.map((msg) => (
                <ChatBubble 
                    key={msg.id} 
                    message={msg} 
                    sender={participants.find(p => p.id === msg.senderId)} 
                    participants={participants}
                    hostName={userContext?.nickname}
                />
            ))}

            {/* Status Indicators */}
            <div className="mt-8 mb-4 min-h-[60px] flex justify-center">
                {(isTyping || thinkingSpeakerId) && (
                    <div className="flex items-center gap-3 bg-md-surface-container px-4 py-2 rounded-full shadow-sm animate-pulse border border-white/10">
                         <div 
                            className="w-2 h-2 rounded-full" 
                            style={{backgroundColor: participants.find(p => p.id === thinkingSpeakerId)?.color || '#fff'}}
                         ></div>
                         <span className="text-xs font-bold text-md-secondary">
                            {participants.find(p => p.id === thinkingSpeakerId)?.name} is typing...
                         </span>
                    </div>
                )}
            </div>
            
            <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area is Fixed inside the component */}
      <InputArea 
        onSendMessage={handleUserMessage} 
        onSummarize={handleSummarize}
        isDiscussing={true}
        isWaitingForUser={isWaitingForUser}
        participants={participants}
        disabled={!isWaitingForUser || isSummarizing}
      />
      
      {/* ... Modals ... */}
      {isSummarizing && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
             <div className="bg-md-surface-container p-6 rounded-2xl shadow-xl flex flex-col items-center border border-white/10">
                 <Loader2 className="animate-spin text-md-accent mb-4" size={32} />
                 <p className="font-bold text-md-primary">Summarizing discussion...</p>
                 <p className="text-sm text-md-secondary">Extracting core viewpoints</p>
             </div>
          </div>
      )}

      <SummaryModal summary={summary} onClose={() => setSummary(null)} />
    </div>
  );
}