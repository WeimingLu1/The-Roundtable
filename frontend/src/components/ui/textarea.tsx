import * as React from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-4 py-3 rounded-lg border border-gray-300',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          'resize-none transition-all',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
