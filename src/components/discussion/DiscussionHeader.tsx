import React from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Participant } from '@/types';
import { ParticipantAvatar } from '@/components/participants/ParticipantAvatar';
import { Button } from '@/components/ui/button';

interface DiscussionHeaderProps {
  topic: string;
  participants: Participant[];
  onBack: () => void;
}

export function DiscussionHeader({ topic, participants, onBack }: DiscussionHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ChevronLeft className="w-5 h-5" />
      </Button>
      
      <div className="flex -space-x-2">
        {participants.map((p) => (
          <ParticipantAvatar key={p.id} participant={p} size="sm" />
        ))}
      </div>
      
      <div className="w-10" />
    </header>
  );
}
