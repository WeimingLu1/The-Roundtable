import React from 'react';
import type { Message, Participant } from '@/types';

interface ChatBubbleProps {
  message: Message;
  sender?: Participant;
  participants?: Participant[];
  hostName?: string;
}

// Strip thinking tags from Minimax responses for display
function stripThinking(text: string): string {
  return text
    .replace(new RegExp('<think>[\s\S]*?<\/think>', 'g'), '')
    .replace(new RegExp('<thinking>[\s\S]*?</thinking>', 'gi'), '')
    .trim();
}

export function ChatBubble({ message, sender, participants, hostName }: ChatBubbleProps) {
  const isUser = message.senderId === 'user';
  const isHost = !isUser && !sender;
  const displayText = stripThinking(message.text);

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-accent text-accent-foreground rounded-2xl px-4 py-2 max-w-[80%]">
          <p className="text-sm font-medium mb-1">{hostName || 'You'}</p>
          <p>{displayText}</p>
        </div>
      </div>
    );
  }

  if (!sender) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="flex gap-3 max-w-[80%]">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: sender.color }}
        >
          {sender.name[0]}
        </div>
        <div>
          <p className="text-xs font-medium mb-1 opacity-70">{sender.name}</p>
          <div className="bg-secondary/20 rounded-2xl px-4 py-2">
            <p>{displayText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
