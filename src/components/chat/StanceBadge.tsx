import { ThumbsUp, ThumbsDown, Hand, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

type StanceType = 'AGREE' | 'DISAGREE' | 'PARTIAL' | 'PIVOT' | 'NEUTRAL';

interface StanceBadgeProps {
  stance: StanceType;
  intensity?: number;
  className?: string;
}

const stanceConfig = {
  AGREE: {
    bg: 'bg-[#4ADE80]/20',
    text: 'text-[#4ADE80]',
    icon: ThumbsUp,
    label: 'Agree',
  },
  DISAGREE: {
    bg: 'bg-[#F87171]/20',
    text: 'text-[#F87171]',
    icon: ThumbsDown,
    label: 'Disagree',
  },
  PARTIAL: {
    bg: 'bg-[#FBBF24]/20',
    text: 'text-[#FBBF24]',
    icon: Hand,
    label: 'Partial',
  },
  PIVOT: {
    bg: 'bg-[#60A5FA]/20',
    text: 'text-[#60A5FA]',
    icon: GitBranch,
    label: 'Pivot',
  },
  NEUTRAL: {
    bg: 'bg-[#9898A8]/20',
    text: 'text-[#9898A8]',
    icon: Hand,
    label: 'Neutral',
  },
};

export function StanceBadge({ stance, intensity, className }: StanceBadgeProps) {
  const config = stanceConfig[stance];
  const Icon = config.icon;

  let intensityText = '';
  if (intensity) {
    if (intensity >= 4) intensityText = 'Strongly ';
    else if (intensity <= 2) intensityText = 'Slightly ';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {intensityText}{config.label}
    </span>
  );
}
