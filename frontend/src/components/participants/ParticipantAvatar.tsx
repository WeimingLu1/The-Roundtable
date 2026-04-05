import { cn } from '@/lib/utils';

interface ParticipantAvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ParticipantAvatar({
  name,
  color,
  size = 'md',
  className,
}: ParticipantAvatarProps) {
  const initial = name.charAt(0).toUpperCase();
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  );
}
