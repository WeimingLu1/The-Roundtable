import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Sparkles, Lock } from 'lucide-react';
import { Participant } from '../types';

interface InputAreaProps {
  onSendMessage: (text: string) => void;
  onSummarize: () => void;
  isDiscussing: boolean;
  isWaitingForUser: boolean;
  participants: Participant[];
  disabled: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  onSummarize, 
  isDiscussing,
  isWaitingForUser,
  participants,
  disabled
}) => {
  const [text, setText] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onSendMessage(text);
    setText('');
    setShowMentionPopup(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      if (val.endsWith('@')) setShowMentionPopup(true);
      else if (!val.includes('@')) setShowMentionPopup(false);
  };

  const insertMention = (name: string) => {
      setText(prev => prev + name + ' ');
      setShowMentionPopup(false);
      textareaRef.current?.focus();
  };

  useEffect(() => {
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
  }, [text]);

  if (!isDiscussing) return null;

  let placeholder = "Guide the conversation...";
  if (disabled) placeholder = "Roundtable is speaking...";
  else if (isWaitingForUser) placeholder = "It's your turn, Host... (Tip: use @ to cue a speaker)";

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-md-surface/95 backdrop-blur-xl p-4 pb-6 z-50 border-t border-white/5 transition-all duration-500
        ${isWaitingForUser ? 'shadow-[0_-5px_30px_rgba(187,134,252,0.15)]' : ''}
    `}>
      
      {/* Mention Popup */}
      {showMentionPopup && !disabled && participants.length > 0 && (
        <div className="absolute bottom-24 left-4 bg-md-surface-container rounded-xl shadow-elevation-3 overflow-hidden min-w-[180px] animate-fade-in-up border border-white/10">
            <div className="px-4 py-2 bg-md-surface-container-low text-xs font-bold text-md-secondary">Mention Guest</div>
            {participants.map(p => (
                <button
                    key={p.id}
                    onClick={() => insertMention(p.name || 'Guest')}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors"
                >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{backgroundColor: p.color}}>
                        {p.name?.[0] ?? '?'}
                    </div>
                    <span className="font-medium text-md-primary">{p.name || 'Guest'}</span>
                </button>
            ))}
        </div>
      )}

      {/* Host Turn Indicator Overlay */}
      {isWaitingForUser && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-fade-in-up">
            <div className="bg-md-accent text-black px-4 py-1 rounded-full text-xs font-bold shadow-glow flex items-center gap-2">
                <Sparkles size={12} fill="black" /> Your Turn
            </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto flex items-end gap-3">
        {/* Action Buttons Group */}
        <div className="flex gap-2 bg-md-surface-container-low p-1 rounded-full border border-white/10 shadow-sm">
             <button 
                onClick={onSummarize}
                disabled={disabled} // Disabled when it's not the user's turn
                className={`p-3 rounded-full transition-all ${
                    disabled 
                    ? 'text-gray-600 cursor-not-allowed opacity-50' 
                    : 'text-md-secondary hover:text-md-primary hover:bg-white/10'
                }`}
                title="Summarize Discussion"
            >
                <Sparkles size={20} />
            </button>
        </div>

        {/* Input Field */}
        <div className={`flex-1 rounded-[28px] px-6 py-3 border transition-all duration-300 shadow-sm flex items-center relative
            ${disabled 
                ? 'bg-md-surface-container-low border-transparent opacity-50' 
                : isWaitingForUser
                    ? 'bg-md-surface-container border-md-accent/50 ring-1 ring-md-accent/20 animate-pulse-glow'
                    : 'bg-md-surface-container border-white/10 focus-within:ring-2 focus-within:ring-white/10'
            }
        `}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 text-md-primary placeholder-gray-500 text-base"
            rows={1}
            autoFocus={isWaitingForUser}
          />
          {disabled && <Lock size={16} className="text-gray-500 ml-2" />}
        </div>

        {/* FAB Send Button */}
        <button 
          onClick={handleSubmit}
          disabled={!text.trim() || disabled}
          className={`w-14 h-14 rounded-[20px] flex items-center justify-center flex-shrink-0 transition-all shadow-elevation-2 ${
            text.trim() && !disabled
              ? 'bg-md-accent text-black hover:scale-105 active:scale-95 shadow-glow' 
              : 'bg-md-surface-container-low text-gray-500'
          }`}
        >
          <Send size={24} />
        </button>
      </div>
    </div>
  );
};