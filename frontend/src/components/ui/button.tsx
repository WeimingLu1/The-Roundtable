import * as React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all rounded-lg border-2',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          {
            'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 border-transparent':
              variant === 'primary',
            'bg-pink-600 text-white hover:bg-pink-700 focus:ring-pink-500 border-transparent':
              variant === 'secondary',
            'bg-gray-300 hover:bg-gray-400 text-gray-800 focus:ring-gray-500 border-transparent':
              variant === 'ghost',
            'bg-white text-indigo-600 border-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500':
              variant === 'outline',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border-transparent':
              variant === 'danger',
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
