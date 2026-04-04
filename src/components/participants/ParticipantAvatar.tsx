import React from 'react';
import type { Participant } from '@/types';

interface ParticipantAvatarProps {
  participant: Participant;
  size?: 'sm' | 'md' | 'lg';
}

export function ParticipantAvatar({ participant, size = 'md' }: ParticipantAvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-12 h-12 text-sm',
  };

  return (
    <div
      className={`rounded-full border-2 border-background flex items-center justify-center text-white font-bold ${sizeClasses[size]}`}
      style={{ backgroundColor: participant.color }}
      title={participant.name}
    >
      {participant.name[0]}
    </div>
  );
}
