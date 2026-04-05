import { useAppStore } from '@/stores/useAppStore';
import { SummaryModal } from './SummaryModal';

interface SummaryViewProps {
  onNewDebate: () => void;
}

export function SummaryView({ onNewDebate }: SummaryViewProps) {
  const { summary, participants } = useAppStore();
  if (!summary) return null;
  return (
    <SummaryModal
      summary={summary}
      participants={participants}
      onClose={() => {}}
      onNewDebate={onNewDebate}
    />
  );
}
