import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = ({
  children,
  className,
  sideOffset = 4,
  ...props
}: {
  children: ReactNode;
  className?: string;
  sideOffset?: number;
}) => {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[8rem] overflow-hidden rounded-[var(--radius)] border border-border bg-surface-elevated p-1 shadow-lg',
          className
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
};

export const DropdownMenuItem = ({
  children,
  className,
  onClick,
  ...props
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) => {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-surface-hover focus:bg-surface-hover',
        className
      )}
      onSelect={onClick}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
};

export const DropdownMenuSeparator = ({ className }: { className?: string }) => {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border', className)}
    />
  );
};
