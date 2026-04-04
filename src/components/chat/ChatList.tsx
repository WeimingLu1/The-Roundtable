import React from 'react';
import type { Message, Participant } from '@/types';
import { ChatBubble } from './ChatBubble';

interface ChatListProps {
  messages: Message[];
  participants: Participant[];
  hostName?: string;
}

export function ChatList({ messages, participants, hostName }: ChatListProps) {
  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          sender={participants.find((p) => p.id === msg.senderId)}
          participants={participants}
          hostName={hostName}
        />
      ))}
    </div>
  );
}
