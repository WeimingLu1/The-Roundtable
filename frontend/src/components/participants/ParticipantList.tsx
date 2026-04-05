import type { Participant } from '@/types';
import { ParticipantCard } from './ParticipantCard';
import { Button } from '@/components/ui/button';

interface ParticipantListProps {
  participants: Participant[];
  onUpdate: (id: string, updates: Partial<Participant>) => void;
  onReplace: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ParticipantList({
  participants,
  onUpdate,
  onReplace,
  onConfirm,
  onCancel,
}: ParticipantListProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6">
        Your Debate Panel
      </h2>
      <div className="grid gap-4">
        {participants.map((p) => (
          <ParticipantCard
            key={p.id}
            participant={p}
            onUpdate={onUpdate}
            onReplace={onReplace}
          />
        ))}
      </div>
      <div className="flex gap-3 justify-center pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} className="px-8">
          Start the Roundtable
        </Button>
      </div>
    </div>
  );
}
