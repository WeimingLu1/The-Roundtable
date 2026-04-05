import { useState } from 'react';
import type { Participant } from '@/types';
import { ParticipantAvatar } from './ParticipantAvatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { lookupParticipant } from '@/services/api';

interface ParticipantCardProps {
  participant: Participant;
  onUpdate: (id: string, updates: Partial<Participant>) => void;
  topic: string;
}

export function ParticipantCard({
  participant,
  onUpdate,
  topic,
}: ParticipantCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(participant.name);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const handleLookup = async () => {
    if (!editName.trim()) return;

    setIsLookingUp(true);
    try {
      const lookedUp = await lookupParticipant(editName.trim(), topic);
      onUpdate(participant.id, {
        name: lookedUp.name,
        title: lookedUp.title,
        stance: lookedUp.stance,
        color: lookedUp.color,
      });
      setEditName(lookedUp.name);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to lookup participant:', err);
    } finally {
      setIsLookingUp(false);
    }
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
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">姓名</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  autoFocus
                  placeholder="输入人物姓名..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleLookup}
                  disabled={!editName.trim() || isLookingUp}
                >
                  {isLookingUp ? (
                    <>
                      <Spinner className="mr-1 h-3 w-3" />
                      查询中...
                    </>
                  ) : (
                    '查询'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditName(participant.name);
                    setIsEditing(false);
                  }}
                >
                  取消
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                输入姓名并点击查询，AI将自动填充完整资料
              </p>
            </div>
          ) : (
            <>
              <h3 className="font-bold text-lg">{participant.name}</h3>
              <p className="text-sm text-gray-600">{participant.title}</p>
              <p className="text-sm italic mt-1" style={{ color: participant.color }}>
                "{participant.stance}"
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="mt-3"
              >
                编辑
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}