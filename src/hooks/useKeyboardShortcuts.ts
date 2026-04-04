import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

export function useKeyboardShortcuts(inputRef: React.RefObject<HTMLTextAreaElement | null>) {
  const { setAppState, setIsSummarizing } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (isMod && e.key === 's') {
        e.preventDefault();
        setIsSummarizing(true);
      }
      if (isMod && e.key === 'n') {
        e.preventDefault();
        useAppStore.getState().resetAll();
        setAppState('ONBOARDING');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputRef, setAppState, setIsSummarizing]);
}
