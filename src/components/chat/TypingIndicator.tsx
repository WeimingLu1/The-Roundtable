import React from 'react';
import type { Participant } from '@/types';

interface TypingIndicatorProps {
  speaker: Participant;
}

export function TypingIndicator({ speaker }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 bg-secondary/20 rounded-full px-4 py-2 w-fit">
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: speaker.color }}
      />
      <span className="text-sm text-muted-foreground">
        {speaker.name} is typing...
      </span>
    </div>
  );
}
