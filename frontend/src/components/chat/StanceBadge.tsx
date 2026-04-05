import type { Stance } from '@/types';
import { cn } from '@/lib/utils';

const stanceConfig: Record<Stance, { label: string; color: string }> = {
  AGREE: { label: '👍 Agree', color: 'bg-green-100 text-green-800' },
  DISAGREE: { label: '👎 Disagree', color: 'bg-red-100 text-red-800' },
  PARTIAL: { label: '🤔 Partial', color: 'bg-yellow-100 text-yellow-800' },
  PIVOT: { label: '🔄 Pivot', color: 'bg-blue-100 text-blue-800' },
  NEUTRAL: { label: '😐 Neutral', color: 'bg-gray-100 text-gray-800' },
};

interface StanceBadgeProps {
  stance: Stance;
  intensity?: number;
}

export function StanceBadge({ stance, intensity }: StanceBadgeProps) {
  const config = stanceConfig[stance] || stanceConfig.NEUTRAL;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs', config.color)}>
      {config.label}
      {intensity && <span className="opacity-60">×{intensity}</span>}
    </span>
  );
}
