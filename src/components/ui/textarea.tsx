import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean;
}

export function Textarea({ className, autoResize = true, onChange, ...props }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = ref.current;
    if (textarea && autoResize) {
      textarea.style.height = 'auto';
      const lineHeight = 24;
      const maxRows = 6;
      const minHeight = lineHeight;
      const maxHeight = lineHeight * maxRows;
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, []);

  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-h-[40px] px-3 py-2 rounded-[var(--radius)] bg-surface border border-border text-foreground placeholder:text-secondary resize-none transition-colors',
        'focus:outline-none focus:border-accent',
        className
      )}
      onChange={(e) => {
        onChange?.(e);
        adjustHeight();
      }}
      rows={1}
      {...props}
    />
  );
}
