import { useState } from 'react';
import type { Participant } from '@/types';
import { ParticipantAvatar } from './ParticipantAvatar';
import { Button } from '@/components/ui/button';

interface ParticipantCardProps {
  participant: Participant;
  onUpdate: (id: string, updates: Partial<Participant>) => void;
  onReplace: (id: string) => void;
}

export function ParticipantCard({
  participant,
  onUpdate,
  onReplace,
}: ParticipantCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(participant.name);

  const handleSave = () => {
    onUpdate(participant.id, { name: editName });
    setIsEditing(false);
  };

  return (
    <div
      className="p-4 rounded-xl border-2 transition-all"
      style={{ borderColor: participant.color + '40', backgroundColor: participant.color + '10' }}
    >
      <div className="flex items-start gap-4">
        <ParticipantAvatar
          name={participant.name}
          color={participant.color}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-bold text-lg">{participant.name}</h3>
              <p className="text-sm text-gray-600">{participant.title}</p>
              <p className="text-sm italic mt-1" style={{ color: participant.color }}>
                "{participant.stance}"
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onReplace(participant.id)}>
                  Replace
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
