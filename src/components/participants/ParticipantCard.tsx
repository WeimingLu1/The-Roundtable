import React from 'react';
import type { Participant } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ParticipantCardProps {
  participant: Participant;
  onUpdate?: (id: string, name: string) => void;
  onReplace?: (id: string, input: string) => void;
  isUpdating?: boolean;
}

export function ParticipantCard({ participant, onUpdate, onReplace, isUpdating }: ParticipantCardProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(participant.name);

  const handleSave = () => {
    if (onUpdate && editName !== participant.name) {
      onUpdate(participant.id, editName);
    }
    setIsEditing(false);
  };

  return (
    <Card className="p-6 w-64 text-center">
      <div
        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold"
        style={{ backgroundColor: participant.color }}
      >
        {participant.name[0]}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1 text-center"
          />
          <Button size="sm" onClick={handleSave}>Save</Button>
        </div>
      ) : (
        <>
          <h3 className="font-bold text-lg">{participant.name}</h3>
          <p className="text-sm text-muted-foreground">{participant.title}</p>
          <p className="text-xs mt-2 italic opacity-70">"{participant.stance}"</p>
          <div className="flex gap-2 mt-4 justify-center">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
            {onReplace && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const input = prompt('Enter name or description:');
                  if (input) onReplace(participant.id, input);
                }}
                disabled={isUpdating}
              >
                {isUpdating ? 'Loading...' : 'Replace'}
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
