import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface InputAreaProps {
  onSend: (message: string) => void;
  onSummarize?: () => void;
  disabled?: boolean;
  isWaiting?: boolean;
}

export function InputArea({ onSend, onSummarize, disabled, isWaiting }: InputAreaProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isWaiting ? 'Take the floor...' : 'Share your thoughts...'}
            disabled={disabled}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>
        <Button onClick={handleSend} disabled={disabled || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
        {onSummarize && (
          <Button variant="outline" onClick={onSummarize} disabled={disabled}>
            Summarize
          </Button>
        )}
      </div>
    </div>
  );
}
