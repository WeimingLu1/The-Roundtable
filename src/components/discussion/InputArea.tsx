import React from 'react';
import type { Participant } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface InputAreaProps {
  onSendMessage: (text: string) => void;
  onSummarize?: () => void;
  participants?: Participant[];
  isWaitingForUser?: boolean;
  disabled?: boolean;
}

export function InputArea({ onSendMessage, onSummarize, isWaitingForUser, disabled }: InputAreaProps) {
  const [text, setText] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendMessage(text);
    setText('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={isWaitingForUser ? "Type your message..." : "Wait for the panel..."}
        disabled={disabled}
        className="resize-none"
        rows={2}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={disabled || !text.trim()}>
          Send
        </Button>
        {onSummarize && (
          <Button type="button" variant="secondary" size="sm" onClick={onSummarize}>
            Summarize
          </Button>
        )}
      </div>
    </form>
  );
}
