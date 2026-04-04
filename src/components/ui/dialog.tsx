import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function DialogTrigger({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
  return <DialogPrimitive.Trigger asChild={asChild}>{children}</DialogPrimitive.Trigger>;
}

export function DialogOverlay({ className, ...props }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay asChild>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn('fixed inset-0 z-50 bg-black/60 backdrop-blur-sm', className)}
        {...props}
      />
    </DialogPrimitive.Overlay>
  );
}

interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <AnimatePresence>
        <DialogOverlay />
        <DialogPrimitive.Content asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-border bg-surface-elevated p-6 shadow-xl',
              className
            )}
          >
            {children}
          </motion.div>
        </DialogPrimitive.Content>
      </AnimatePresence>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, children, ...props }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5 mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogFooter({ className, children, ...props }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex justify-end gap-2 mt-4', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, ...props }: { children: ReactNode }) {
  return <DialogPrimitive.Title className="text-lg font-semibold" {...props}>{children}</DialogPrimitive.Title>;
}

export function DialogDescription({ children, ...props }: { children: ReactNode }) {
  return <DialogPrimitive.Description className="text-sm text-secondary" {...props}>{children}</DialogPrimitive.Description>;
}

export function DialogClose({ children, asChild }: { children?: ReactNode; asChild?: boolean }) {
  return (
    <DialogPrimitive.Close asChild={asChild}>
      {children || <X className="h-4 w-4" />}
    </DialogPrimitive.Close>
  );
}
