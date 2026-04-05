import type { DebateConfig } from '@/types';
import { cn } from '@/lib/utils';

interface SpeedControlProps {
  speed: DebateConfig['speed'];
  onChange: (speed: DebateConfig['speed']) => void;
}

const speedOptions: { value: DebateConfig['speed']; label: string }[] = [
  { value: 'slow', label: '🐢 Slow' },
  { value: 'normal', label: '🚶 Normal' },
  { value: 'fast', label: '⚡ Fast' },
];

export function SpeedControl({ speed, onChange }: SpeedControlProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {speedOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 rounded text-sm transition-all',
            speed === opt.value
              ? 'bg-white shadow text-primary font-medium'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
