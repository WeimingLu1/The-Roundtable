import type { Participant } from '@/types';
import { ParticipantCard } from './ParticipantCard';
import { Button } from '@/components/ui/button';

interface ParticipantListProps {
  participants: Participant[];
  topic: string;
  onUpdate: (id: string, updates: Partial<Participant>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ParticipantList({
  participants,
  topic,
  onUpdate,
  onConfirm,
  onCancel,
}: ParticipantListProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6">
        你的辩论嘉宾
      </h2>
      <div className="grid gap-4">
        {participants.map((p) => (
          <ParticipantCard
            key={p.id}
            participant={p}
            topic={topic}
            onUpdate={onUpdate}
          />
        ))}
      </div>
      <div className="flex gap-3 justify-center pt-4">
        <Button variant="ghost" onClick={onCancel}>
          返回
        </Button>
        <Button variant="primary" onClick={onConfirm} className="px-8">
          开始圆桌讨论
        </Button>
      </div>
    </div>
  );
}