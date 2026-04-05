import type { Summary, Participant } from '@/types';
import { SummaryModal } from './SummaryModal';

interface SummaryViewProps {
  summary: Summary;
  participants: Participant[];
  onNewDebate: () => void;
}

export function SummaryView({ summary, participants, onNewDebate }: SummaryViewProps) {
  return (
    <SummaryModal
      summary={summary}
      participants={participants}
      onClose={() => {}}
      onNewDebate={onNewDebate}
    />
  );
}
