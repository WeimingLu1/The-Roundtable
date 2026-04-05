import * as React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ className, variant = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl',
        {
          'bg-white shadow': variant === 'default',
          'bg-white shadow-lg': variant === 'elevated',
          'border-2 border-gray-200': variant === 'outlined',
        },
        className
      )}
      {...props}
    />
  );
}
