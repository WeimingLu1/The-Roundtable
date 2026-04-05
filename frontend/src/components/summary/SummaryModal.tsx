import type { Summary, Participant } from '@/types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ParticipantAvatar } from '../participants/ParticipantAvatar';

interface SummaryModalProps {
  summary: Summary;
  participants: Participant[];
  onClose: () => void;
  onNewDebate: () => void;
}

export function SummaryModal({ summary, participants, onClose, onNewDebate }: SummaryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-2">{summary.topic}</h2>
        <p className="text-gray-500 mb-6">辩论总结</p>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">主要观点</h3>
            <div className="space-y-3">
              {Object.entries(summary.viewpoints).map(([name, viewpoint]) => {
                const participant = participants.find((p) => p.name === name);
                return (
                  <div key={name} className="flex gap-3">
                    {participant && (
                      <ParticipantAvatar
                        name={participant.name}
                        color={participant.color}
                        size="sm"
                        className="mt-1"
                      />
                    )}
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-gray-600 text-sm">{viewpoint}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">待讨论问题</h3>
            <ul className="list-disc list-inside space-y-1">
              {summary.openQuestions.map((q, i) => (
                <li key={i} className="text-gray-600 text-sm">{q}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-3 justify-center mt-8">
          <Button variant="ghost" onClick={onClose}>
            返回讨论
          </Button>
          <Button onClick={onNewDebate}>开始新辩论</Button>
        </div>
      </Card>
    </div>
  );
}
