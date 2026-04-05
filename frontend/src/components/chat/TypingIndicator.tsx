import type { Participant } from '@/types';
import { ParticipantAvatar } from '../participants/ParticipantAvatar';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  participant: Participant;
}

export function TypingIndicator({ participant }: TypingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-3"
    >
      <ParticipantAvatar name={participant.name} color={participant.color} size="md" />
      <div className="flex items-center gap-1">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="w-2 h-2 bg-gray-400 rounded-full"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
          className="w-2 h-2 bg-gray-400 rounded-full"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
          className="w-2 h-2 bg-gray-400 rounded-full"
        />
      </div>
      <span className="text-sm text-gray-500">{participant.name} 正在输入...</span>
    </motion.div>
  );
}
