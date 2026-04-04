import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';
type Speed = 'slow' | 'normal' | 'fast' | 'instant';

interface SettingsState {
  theme: Theme;
  speed: Speed;
  setTheme: (theme: Theme) => void;
  setSpeed: (speed: Speed) => void;
  getDelay: () => number;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      speed: 'normal',

      setTheme: (theme) => {
        set({ theme });
        const root = window.document.documentElement;
        root.classList.remove('light');
        if (theme === 'light') {
          root.classList.add('light');
        } else if (theme === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (!isDark) root.classList.add('light');
        } else {
          root.classList.remove('light');
        }
      },

      setSpeed: (speed) => set({ speed }),

      getDelay: () => {
        const { speed } = get();
        switch (speed) {
          case 'slow': return 1000 + Math.random() * 1000;
          case 'normal': return 500 + Math.random() * 500;
          case 'fast': return 200 + Math.random() * 300;
          case 'instant': return 0;
        }
      },
    }),
    { name: 'roundtable-settings' }
  )
);
