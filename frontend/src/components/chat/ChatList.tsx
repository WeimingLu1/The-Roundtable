import { useRef, useEffect } from 'react';
import type { Message, Participant } from '@/types';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { useAppStore } from '@/stores/useAppStore';

interface ChatListProps {
  messages: Message[];
  participants: Participant[];
  userName: string;
}

export function ChatList({ messages, participants, userName }: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const thinkingSpeakerId = useAppStore((s) => s.thinkingSpeakerId);
  const thinkingParticipant = participants.find((p) => p.id === thinkingSpeakerId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingSpeakerId]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg) => {
        const participant = participants.find((p) => p.id === msg.participantId);
        const isHost = msg.participantId === 'host';
        return (
          <ChatBubble
            key={msg.id}
            message={msg}
            participant={participant}
            isHost={isHost}
          />
        );
      })}
      {thinkingParticipant && (
        <TypingIndicator participant={thinkingParticipant} />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
