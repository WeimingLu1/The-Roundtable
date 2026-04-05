import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { Participant } from '@/types';

interface InputAreaProps {
  participants: Participant[];
  onSend: (message: string, mentionedId?: string) => void;
  onSummarize?: () => void;
  disabled?: boolean;
  isWaiting?: boolean;
  isSummarizing?: boolean;
}

export function InputArea({
  participants,
  onSend,
  onSummarize,
  disabled,
  isWaiting,
  isSummarizing,
}: InputAreaProps) {
  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredParticipants = participants.filter(
    (p) => !mentionFilter || p.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  useEffect(() => {
    if (showMentions) {
      setSelectedMentionIndex(0);
    }
  }, [showMentions, mentionFilter]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInput(value);

    // Check if we're in a mention context
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // If there's no space after @, we're in a mention
      if (!textAfterAt.includes(' ') && textAfterAt.length < 20) {
        setMentionFilter(textAfterAt);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (name: string) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = input.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    const newInput =
      input.slice(0, lastAtIndex) + '@' + name + ' ' + input.slice(cursorPos);
    setInput(newInput);
    setShowMentions(false);

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = lastAtIndex + name.length + 2;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredParticipants.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((i) => (i + 1) % filteredParticipants.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(
          (i) => (i - 1 + filteredParticipants.length) % filteredParticipants.length
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredParticipants[selectedMentionIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!input.trim() || disabled) return;

    // Check for @ mentions
    const mentionMatch = input.match(/@(\S+)/);
    let mentionedId: string | undefined;

    if (mentionMatch) {
      const mentionedName = mentionMatch[1];
      const mentioned = participants.find(
        (p) => p.name.toLowerCase() === mentionedName.toLowerCase()
      );
      if (mentioned) {
        mentionedId = mentioned.id;
      }
    }

    onSend(input.trim(), mentionedId);
    setInput('');
    setShowMentions(false);
  };

  return (
    <div className={`border-t p-4 transition-colors ${isWaiting ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'}`}>
      {isWaiting && (
        <div className="mb-2 text-sm text-indigo-600 font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
          轮到你了，请发言
        </div>
      )}
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isWaiting ? '请发言... (输入@提及嘉宾)' : '等待AI发言...'}
            disabled={disabled}
            rows={2}
            className={isWaiting ? 'border-indigo-300 focus:border-indigo-500' : ''}
          />
          {showMentions && filteredParticipants.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto z-50">
              {filteredParticipants.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => insertMention(p.name)}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 ${
                    i === selectedMentionIndex ? 'bg-gray-100' : ''
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.title}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={handleSend} disabled={disabled || !input.trim()} variant={isWaiting ? "primary" : "ghost"}>
          <Send className="w-4 h-4" />
        </Button>
        {onSummarize && (
          <Button variant="secondary" onClick={onSummarize} disabled={disabled || isSummarizing}>
            {isSummarizing ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                生成中...
              </>
            ) : (
              '总结'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
