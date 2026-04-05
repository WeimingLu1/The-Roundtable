import type { Participant } from '@/types';
import { ParticipantAvatar } from '../participants/ParticipantAvatar';
import { ArrowLeft } from 'lucide-react';

interface DiscussionHeaderProps {
  topic: string;
  participants: Participant[];
  onBack?: () => void;
}

export function DiscussionHeader({ topic, participants, onBack }: DiscussionHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="font-semibold text-lg">{topic}</h2>
            <div className="flex items-center gap-1 mt-1">
              {participants.map((p) => (
                <ParticipantAvatar key={p.id} name={p.name} color={p.color} size="sm" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
