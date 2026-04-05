import { motion } from 'framer-motion';
import type { Message, Participant } from '@/types';
import { ParticipantAvatar } from '../participants/ParticipantAvatar';
import { StanceBadge } from './StanceBadge';
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  message: Message;
  participant: Participant | undefined;
  isHost?: boolean;
}

export function ChatBubble({ message, participant, isHost = false }: ChatBubbleProps) {
  const isUser = !participant;

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {participant && (
        <ParticipantAvatar
          name={participant.name}
          color={participant.color}
          size="md"
        />
      )}
      <div className={cn('max-w-[70%]', isUser && 'items-end')}>
        {participant && (
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{participant.name}</span>
            {message.stance && (
              <StanceBadge stance={message.stance} intensity={message.intensity} />
            )}
          </div>
        )}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl shadow-sm',
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-white text-gray-900 rounded-tl-sm border border-gray-200'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </motion.div>
  );
}
