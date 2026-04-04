import { cn } from '@/lib/utils';
import type { ReactNode, MouseEventHandler } from 'react';

interface ButtonProps {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: ReactNode;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  title?: string;
}

const variants = {
  default: 'bg-accent text-white hover:bg-accent/90 active:scale-[0.97]',
  secondary: 'bg-surface-elevated text-foreground hover:bg-surface-hover active:scale-[0.97]',
  ghost: 'bg-transparent hover:bg-surface-hover active:scale-[0.97]',
  outline: 'bg-transparent border border-border hover:bg-surface-hover active:scale-[0.97]',
};

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
};

export function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  disabled,
  onClick,
  type = 'button',
  title,
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none active:transition-transform',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
      title={title}
    >
      {children}
    </button>
  );
}
