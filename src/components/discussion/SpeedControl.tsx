import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/useSettingsStore';

const speeds = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
  { value: 'instant', label: 'Instant' },
] as const;

export function SpeedControl() {
  const { speed, setSpeed } = useSettingsStore();

  return (
    <div className="flex items-center gap-1 p-1 bg-surface-elevated rounded-full">
      {speeds.map((s) => (
        <button
          key={s.value}
          onClick={() => setSpeed(s.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full transition-colors',
            speed === s.value
              ? 'bg-accent text-white'
              : 'text-secondary hover:text-foreground'
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
