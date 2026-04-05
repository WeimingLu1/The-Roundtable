import * as React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all rounded-lg',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          {
            'bg-primary text-white hover:bg-primary/90 focus:ring-primary':
              variant === 'primary',
            'bg-secondary text-white hover:bg-secondary/90 focus:ring-secondary':
              variant === 'secondary',
            'hover:bg-gray-100 focus:ring-gray-400': variant === 'ghost',
            'border-2 border-primary text-primary hover:bg-primary/10':
              variant === 'outline',
          },
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
