import type { Stance } from '@/types';
import { cn } from '@/lib/utils';

const stanceConfig: Record<Stance, { emoji: string; label: string; color: string }> = {
  AGREE: { emoji: '👍', label: '同意', color: 'bg-green-100 text-green-800 border border-green-300' },
  DISAGREE: { emoji: '👎', label: '反对', color: 'bg-red-100 text-red-800 border border-red-300' },
  PARTIAL: { emoji: '🤔', label: '部分', color: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
  PIVOT: { emoji: '🔄', label: '转向', color: 'bg-blue-100 text-blue-800 border border-blue-300' },
  NEUTRAL: { emoji: '😐', label: '中立', color: 'bg-gray-100 text-gray-800 border border-gray-300' },
};

interface StanceBadgeProps {
  stance: Stance;
  intensity?: number;
}

export function StanceBadge({ stance, intensity }: StanceBadgeProps) {
  const config = stanceConfig[stance] || stanceConfig.NEUTRAL;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        config.color
      )}
      title={`${config.label} (强度 ${intensity || 3})`}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}
