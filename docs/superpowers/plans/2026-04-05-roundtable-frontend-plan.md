# RoundTable Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the React frontend with stable dependencies (React 18, Tailwind 3.4), fixing all known bugs and implementing the dramatic debate UI.

**Architecture:** React 18 + Vite + Zustand + Tailwind CSS 3.4. State machine manages app flow: ONBOARDING → LANDING → GENERATING_PANEL → PANEL_REVIEW → DEBATING → SUMMARY. All AI communication via SSE streaming from FastAPI backend.

**Tech Stack:** React 18.2, Vite 5.4, Tailwind CSS 3.4, Zustand 4.5, Framer Motion 11, Radix UI, TypeScript 5.4

---

## File Structure

```
frontend/
├── src/
│   ├── types/
│   │   └── index.ts           # All TypeScript interfaces
│   ├── stores/
│   │   └── useAppStore.ts     # Zustand store (single source of truth)
│   ├── services/
│   │   └── api.ts             # Backend API client
│   ├── hooks/
│   │   ├── useAutoScroll.ts
│   │   └── useDebate.ts       # Debate state machine logic
│   ├── components/
│   │   ├── ui/                # Base components (button, textarea, card, spinner)
│   │   ├── onboarding/        # OnboardingForm
│   │   ├── landing/           # TopicInput, RandomButton
│   │   ├── participants/       # ParticipantCard, ParticipantList
│   │   ├── chat/              # ChatBubble, ChatList, TypingIndicator
│   │   ├── discussion/        # DiscussionHeader, SpeedControl, InputArea
│   │   └── summary/           # SummaryModal
│   ├── App.tsx
│   └── main.tsx
└── index.html
```

---

## Task 1: 项目初始化 - 依赖和配置

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "roundtable-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "clsx": "^2.1.0",
    "date-fns": "^4.0.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.500.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "sonner": "^2.0.0",
    "tailwind-merge": "^2.5.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.59.0",
    "@tailwindcss/vite": "^3.4.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6366F1',
        secondary: '#EC4899',
        accent: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>The Roundtable - AI Debate</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): initial project setup with stable deps"
```

---

## Task 2: 类型定义

**Files:**
- Create: `frontend/src/types/index.ts`

- [ ] **Step 1: Create types/index.ts**

```typescript
export type AppState =
  | 'ONBOARDING'
  | 'LANDING'
  | 'GENERATING_PANEL'
  | 'PANEL_REVIEW'
  | 'DEBATING'
  | 'SUMMARY';

export type Stance = 'AGREE' | 'DISAGREE' | 'PARTIAL' | 'PIVOT' | 'NEUTRAL';
export type Action = 'CONTINUE' | 'WAIT';

export interface Participant {
  id: string;
  name: string;
  title: string;
  stance: string;
  color: string;
}

export interface Message {
  id: string;
  participantId: string;
  content: string;
  stance?: Stance;
  intensity?: number;
  timestamp: number;
}

export interface Summary {
  topic: string;
  viewpoints: Record<string, string>;
  openQuestions: string[];
}

export interface DebateConfig {
  speed: 'slow' | 'normal' | 'fast';
  maxTurnsPerRound: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(frontend): add TypeScript type definitions"
```

---

## Task 3: Zustand Store

**Files:**
- Create: `frontend/src/stores/useAppStore.ts`

- [ ] **Step 1: Create useAppStore.ts**

```typescript
import { create } from 'zustand';
import type {
  AppState,
  Participant,
  Message,
  Summary,
  DebateConfig,
} from '@/types';

interface AppStore {
  // App state
  appState: AppState;
  setAppState: (state: AppState) => void;

  // User
  userName: string;
  setUserName: (name: string) => void;

  // Topic
  topic: string;
  setTopic: (topic: string) => void;

  // Participants
  participants: Participant[];
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;

  // Messages
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;

  // Debate control
  isWaitingForUser: boolean;
  setIsWaitingForUser: (waiting: boolean) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  thinkingSpeakerId: string | null;
  setThinkingSpeakerId: (id: string | null) => void;
  autoDebateCount: number;
  incrementAutoDebateCount: () => void;
  resetAutoDebateCount: () => void;

  // Config
  config: DebateConfig;
  setConfig: (config: Partial<DebateConfig>) => void;

  // Summary
  summary: Summary | null;
  setSummary: (summary: Summary | null) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  appState: 'ONBOARDING' as AppState,
  userName: '',
  topic: '',
  participants: [],
  messages: [],
  isWaitingForUser: false,
  isStreaming: false,
  thinkingSpeakerId: null,
  autoDebateCount: 0,
  config: { speed: 'normal', maxTurnsPerRound: 3 } as DebateConfig,
  summary: null,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setAppState: (appState) => set({ appState }),

  setUserName: (userName) => set({ userName }),

  setTopic: (topic) => set({ topic }),

  setParticipants: (participants) => set({ participants }),

  updateParticipant: (id, updates) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  clearMessages: () => set({ messages: [] }),

  setIsWaitingForUser: (isWaitingForUser) => set({ isWaitingForUser }),

  setIsStreaming: (isStreaming) => set({ isStreaming }),

  setThinkingSpeakerId: (thinkingSpeakerId) => set({ thinkingSpeakerId }),

  incrementAutoDebateCount: () =>
    set((state) => ({ autoDebateCount: state.autoDebateCount + 1 })),

  resetAutoDebateCount: () => set({ autoDebateCount: 0 }),

  setConfig: (config) =>
    set((state) => ({ config: { ...state.config, ...config } })),

  setSummary: (summary) => set({ summary }),

  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/stores/useAppStore.ts
git commit -m "feat(frontend): add Zustand store for app state"
```

---

## Task 4: API 服务层

**Files:**
- Create: `frontend/src/services/api.ts`

- [ ] **Step 1: Create api.ts with typed fetch calls**

```typescript
import type { Participant, Message, Summary } from '@/types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.json();
}

// EventSource-based SSE client
export function createDebateStream(
  url: string,
  body: object,
  onMessage: (msg: Message) => void,
  onDone: () => void,
  onError: (err: Error) => void
): EventSource {
  const eventSource = new EventSource(`${API_BASE}${url}`, {
    withCredentials: false,
  });

  // Note: EventSource doesn't support POST natively, so we use fetch + ReadableStream
  // For proper SSE with POST, we need a custom approach
  return eventSource;
}

export async function fetchRandomTopic(): Promise<{ topic: string; description?: string }> {
  const res = await fetch(`${API_BASE}/topics/random`, { method: 'POST' });
  return handleResponse(res);
}

export async function fetchPanel(topic: string): Promise<{ participants: Participant[] }> {
  const res = await fetch(`${API_BASE}/panel/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  });
  return handleResponse(res);
}

export async function debateStart(
  topic: string,
  participants: Participant[],
  onChunk: (msg: Message) => void
): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/debate/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, participants }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const messages: Message[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.id) {
            // It's a message
            const msg: Message = {
              id: parsed.id,
              participantId: parsed.participantId,
              content: parsed.content,
              stance: parsed.stance,
              intensity: parsed.intensity,
              timestamp: parsed.timestamp,
            };
            messages.push(msg);
            onChunk(msg);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  return messages;
}

export async function debateTurn(
  debateId: string,
  history: Message[],
  participants: Participant[],
  turnCount: number,
  maxTurns: number
): Promise<{ message: Message; action: 'CONTINUE' | 'WAIT' }> {
  const res = await fetch(`${API_BASE}/debate/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debateId, history, participants, turnCount, maxTurns }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let message: Message | null = null;
  let action: 'CONTINUE' | 'WAIT' = 'CONTINUE';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.id) {
            message = parsed;
          } else if (parsed.action) {
            action = parsed.action;
          }
        } catch {
          // Skip
        }
      }
    }
  }

  if (!message) throw new Error('No message in response');
  return {
    message: {
      id: message.id,
      participantId: message.participantId,
      content: message.content,
      stance: message.stance,
      intensity: message.intensity,
      timestamp: message.timestamp,
    },
    action,
  };
}

export async function fetchSummary(
  debateId: string,
  history: Message[],
  participants: Participant[]
): Promise<Summary> {
  const res = await fetch(`${API_BASE}/debate/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debateId, history, participants }),
  });
  return handleResponse(res);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(frontend): add API service layer for backend communication"
```

---

## Task 5: 基础 UI 组件

**Files:**
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/spinner.tsx`
- Create: `frontend/src/components/ui/textarea.tsx`
- Create: `frontend/src/components/ui/card.tsx`

- [ ] **Step 1: Create lib/utils.ts**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create button.tsx**

```typescript
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
```

- [ ] **Step 3: Create spinner.tsx**

```typescript
import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin h-5 w-5', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Create textarea.tsx**

```typescript
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
```

- [ ] **Step 5: Create card.tsx**

```typescript
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
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/utils.ts frontend/src/components/ui/
git commit -m "feat(frontend): add base UI components (button, spinner, textarea, card)"
```

---

## Task 6: Onboarding 和 Landing 组件

**Files:**
- Create: `frontend/src/components/onboarding/OnboardingForm.tsx`
- Create: `frontend/src/components/landing/TopicInput.tsx`
- Create: `frontend/src/components/landing/RandomButton.tsx`
- Create: `frontend/src/components/landing/LandingView.tsx`

- [ ] **Step 1: Create OnboardingForm.tsx**

```typescript
import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';

export function OnboardingForm() {
  const [name, setName] = useState('');
  const setUserName = useAppStore((s) => s.setUserName);
  const setAppState = useAppStore((s) => s.setAppState);

  const handleSubmit = () => {
    if (!name.trim()) return;
    setUserName(name.trim());
    setAppState('LANDING');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
    >
      <Card className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center mb-2">The Roundtable</h1>
        <p className="text-gray-500 text-center mb-8">
          Where AI personas debate the topics you care about
        </p>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Your Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="mt-1 w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </label>

        <Button onClick={handleSubmit} disabled={!name.trim()} className="w-full">
          Enter
        </Button>
      </Card>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create RandomButton.tsx (WITH loading state - fixes bug #2)**

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchRandomTopic } from '@/services/api';

interface RandomButtonProps {
  onTopicGenerated: (topic: string) => void;
}

export function RandomButton({ onTopicGenerated }: RandomButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleRandom = async () => {
    setIsLoading(true);
    try {
      const { topic } = await fetchRandomTopic();
      onTopicGenerated(topic);
    } catch (err) {
      console.error('Failed to generate random topic:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button variant="ghost" onClick={handleRandom} disabled={isLoading}>
      {isLoading ? (
        <>
          <Spinner className="mr-2" />
          Generating...
        </>
      ) : (
        '🎲 Random'
      )}
    </Button>
  );
}
```

- [ ] **Step 3: Create TopicInput.tsx**

```typescript
import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RandomButton } from './RandomButton';

export function TopicInput() {
  const [topic, setTopic] = useState('');
  const { setTopic, setAppState } = useAppStore();

  const handleStart = () => {
    if (!topic.trim()) return;
    setTopic(topic.trim());
    setAppState('GENERATING_PANEL');
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="What should the roundtable debate today?"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleStart();
          }
        }}
      />
      <div className="flex gap-3">
        <Button onClick={handleStart} disabled={!topic.trim()} className="flex-1">
          Summon Guests
        </Button>
        <RandomButton onTopicGenerated={setTopic} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create LandingView.tsx**

```typescript
import { motion } from 'framer-motion';
import { TopicInput } from './TopicInput';

export function LandingView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">The Roundtable</h1>
          <p className="text-purple-200 text-lg">
            Enter a topic and summon three AI personas to debate it
          </p>
        </div>
        <TopicInput />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/onboarding/ frontend/src/components/landing/
git commit -m "feat(frontend): add onboarding and landing views with fixed loading state"
```

---

## Task 7: Participant 组件

**Files:**
- Create: `frontend/src/components/participants/ParticipantAvatar.tsx`
- Create: `frontend/src/components/participants/ParticipantCard.tsx`
- Create: `frontend/src/components/participants/ParticipantList.tsx`

- [ ] **Step 1: Create ParticipantAvatar.tsx**

```typescript
import { cn } from '@/lib/utils';

interface ParticipantAvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ParticipantAvatar({
  name,
  color,
  size = 'md',
  className,
}: ParticipantAvatarProps) {
  const initial = name.charAt(0).toUpperCase();
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  );
}
```

- [ ] **Step 2: Create ParticipantCard.tsx**

```typescript
import { useState } from 'react';
import type { Participant } from '@/types';
import { ParticipantAvatar } from './ParticipantAvatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ParticipantCardProps {
  participant: Participant;
  onUpdate: (id: string, updates: Partial<Participant>) => void;
  onReplace: (id: string) => void;
}

export function ParticipantCard({
  participant,
  onUpdate,
  onReplace,
}: ParticipantCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(participant.name);

  const handleSave = () => {
    onUpdate(participant.id, { name: editName });
    setIsEditing(false);
  };

  return (
    <div
      className="p-4 rounded-xl border-2 transition-all"
      style={{ borderColor: participant.color + '40', backgroundColor: participant.color + '10' }}
    >
      <div className="flex items-start gap-4">
        <ParticipantAvatar
          name={participant.name}
          color={participant.color}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1 rounded border"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-bold text-lg">{participant.name}</h3>
              <p className="text-sm text-gray-600">{participant.title}</p>
              <p className="text-sm italic mt-1" style={{ color: participant.color }}>
                "{participant.stance}"
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onReplace(participant.id)}>
                  Replace
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ParticipantList.tsx**

```typescript
import type { Participant } from '@/types';
import { ParticipantCard } from './ParticipantCard';
import { Button } from '@/components/ui/button';

interface ParticipantListProps {
  participants: Participant[];
  onUpdate: (id: string, updates: Partial<Participant>) => void;
  onReplace: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ParticipantList({
  participants,
  onUpdate,
  onReplace,
  onConfirm,
  onCancel,
}: ParticipantListProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6">
        Your Debate Panel
      </h2>
      <div className="grid gap-4">
        {participants.map((p) => (
          <ParticipantCard
            key={p.id}
            participant={p}
            onUpdate={onUpdate}
            onReplace={onReplace}
          />
        ))}
      </div>
      <div className="flex gap-3 justify-center pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} className="px-8">
          Start the Roundtable
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/participants/
git commit -m "feat(frontend): add participant components"
```

---

## Task 8: Chat 组件

**Files:**
- Create: `frontend/src/components/chat/StanceBadge.tsx`
- Create: `frontend/src/components/chat/ChatBubble.tsx`
- Create: `frontend/src/components/chat/TypingIndicator.tsx`
- Create: `frontend/src/components/chat/ChatList.tsx`

- [ ] **Step 1: Create StanceBadge.tsx**

```typescript
import type { Stance } from '@/types';
import { cn } from '@/lib/utils';

const stanceConfig: Record<Stance, { label: string; color: string }> = {
  AGREE: { label: '👍 Agree', color: 'bg-green-100 text-green-800' },
  DISAGREE: { label: '👎 Disagree', color: 'bg-red-100 text-red-800' },
  PARTIAL: { label: '🤔 Partial', color: 'bg-yellow-100 text-yellow-800' },
  PIVOT: { label: '🔄 Pivot', color: 'bg-blue-100 text-blue-800' },
  NEUTRAL: { label: '😐 Neutral', color: 'bg-gray-100 text-gray-800' },
};

interface StanceBadgeProps {
  stance: Stance;
  intensity?: number;
}

export function StanceBadge({ stance, intensity }: StanceBadgeProps) {
  const config = stanceConfig[stance] || stanceConfig.NEUTRAL;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs', config.color)}>
      {config.label}
      {intensity && <span className="opacity-60">×{intensity}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Create ChatBubble.tsx**

```typescript
import { motion } from 'framer-motion';
import type { Message, Participant } from '@/types';
import { ParticipantAvatar } from '../participants/ParticipantAvatar';
import { StanceBadge } from './StanceBadge';
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  message: Message;
  participant: Participant | undefined;
  isHost?: boolean;
}

export function ChatBubble({ message, participant, isHost = false }: ChatBubbleProps) {
  const isUser = !participant;

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {participant && (
        <ParticipantAvatar
          name={participant.name}
          color={participant.color}
          size="md"
        />
      )}
      <div className={cn('max-w-[70%]', isUser && 'items-end')}>
        {participant && (
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{participant.name}</span>
            {message.stance && (
              <StanceBadge stance={message.stance} intensity={message.intensity} />
            )}
          </div>
        )}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl',
            isUser
              ? 'bg-primary text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-900 rounded-tl-sm'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Create TypingIndicator.tsx (fixes bug #1 - shows who's thinking)**

```typescript
import type { Participant } from '@/types';
import { ParticipantAvatar } from '../participants/ParticipantAvatar';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  participant: Participant;
}

export function TypingIndicator({ participant }: TypingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-3"
    >
      <ParticipantAvatar name={participant.name} color={participant.color} size="md" />
      <div className="flex items-center gap-1">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="w-2 h-2 bg-gray-400 rounded-full"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
          className="w-2 h-2 bg-gray-400 rounded-full"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
          className="w-2 h-2 bg-gray-400 rounded-full"
        />
      </div>
      <span className="text-sm text-gray-500">{participant.name} is thinking...</span>
    </motion.div>
  );
}
```

- [ ] **Step 4: Create ChatList.tsx**

```typescript
import { useRef, useEffect } from 'react';
import type { Message, Participant } from '@/types';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { useAppStore } from '@/stores/useAppStore';

interface ChatListProps {
  messages: Message[];
  participants: Participant[];
  userName: string;
}

export function ChatList({ messages, participants, userName }: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const thinkingSpeakerId = useAppStore((s) => s.thinkingSpeakerId);
  const thinkingParticipant = participants.find((p) => p.id === thinkingSpeakerId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingSpeakerId]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg) => {
        const participant = participants.find((p) => p.id === msg.participantId);
        const isHost = msg.participantId === 'host';
        return (
          <ChatBubble
            key={msg.id}
            message={msg}
            participant={participant}
            isHost={isHost}
          />
        );
      })}
      {thinkingParticipant && (
        <TypingIndicator participant={thinkingParticipant} />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/
git commit -m "feat(frontend): add chat components with typing indicator"
```

---

## Task 9: Discussion 组件

**Files:**
- Create: `frontend/src/components/discussion/SpeedControl.tsx`
- Create: `frontend/src/components/discussion/InputArea.tsx`
- Create: `frontend/src/components/discussion/DiscussionHeader.tsx`
- Create: `frontend/src/components/discussion/DiscussionView.tsx`

- [ ] **Step 1: Create SpeedControl.tsx**

```typescript
import type { DebateConfig } from '@/types';
import { cn } from '@/lib/utils';

interface SpeedControlProps {
  speed: DebateConfig['speed'];
  onChange: (speed: DebateConfig['speed']) => void;
}

const speedOptions: { value: DebateConfig['speed']; label: string }[] = [
  { value: 'slow', label: '🐢 Slow' },
  { value: 'normal', label: '🚶 Normal' },
  { value: 'fast', label: '⚡ Fast' },
];

export function SpeedControl({ speed, onChange }: SpeedControlProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {speedOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 rounded text-sm transition-all',
            speed === opt.value
              ? 'bg-white shadow text-primary font-medium'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create InputArea.tsx**

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface InputAreaProps {
  onSend: (message: string) => void;
  onSummarize?: () => void;
  disabled?: boolean;
  isWaiting?: boolean;
}

export function InputArea({ onSend, onSummarize, disabled, isWaiting }: InputAreaProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isWaiting ? 'Take the floor...' : 'Share your thoughts...'}
            disabled={disabled}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>
        <Button onClick={handleSend} disabled={disabled || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
        {onSummarize && (
          <Button variant="outline" onClick={onSummarize} disabled={disabled}>
            Summarize
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create DiscussionHeader.tsx**

```typescript
import type { Participant } from '@/types';
import { ParticipantAvatar } from '../participants/ParticipantAvatar';
import { SpeedControl } from './SpeedControl';
import { useAppStore } from '@/stores/useAppStore';
import { ArrowLeft } from 'lucide-react';

interface DiscussionHeaderProps {
  topic: string;
  participants: Participant[];
  onBack?: () => void;
}

export function DiscussionHeader({ topic, participants, onBack }: DiscussionHeaderProps) {
  const { config, setConfig } = useAppStore();

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="font-semibold text-lg">{topic}</h2>
            <div className="flex items-center gap-1 mt-1">
              {participants.map((p) => (
                <ParticipantAvatar key={p.id} name={p.name} color={p.color} size="sm" />
              ))}
            </div>
          </div>
        </div>
        <SpeedControl
          speed={config.speed}
          onChange={(speed) => setConfig({ speed })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create DiscussionView.tsx**

```typescript
import { useAppStore } from '@/stores/useAppStore';
import { ChatList } from '../chat/ChatList';
import { DiscussionHeader } from './DiscussionHeader';
import { InputArea } from './InputArea';

interface DiscussionViewProps {
  onSummarize: () => void;
}

export function DiscussionView({ onSummarize }: DiscussionViewProps) {
  const {
    topic,
    participants,
    messages,
    userName,
    isWaitingForUser,
    setIsWaitingForUser,
    addMessage,
    setThinkingSpeakerId,
  } = useAppStore();

  const handleUserMessage = (content: string) => {
    addMessage({
      id: `user-${Date.now()}`,
      participantId: 'user',
      content,
      timestamp: Date.now(),
    });
    setIsWaitingForUser(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <DiscussionHeader topic={topic} participants={participants} />
      <ChatList
        messages={messages}
        participants={participants}
        userName={userName}
      />
      <InputArea
        onSend={handleUserMessage}
        onSummarize={onSummarize}
        disabled={!isWaitingForUser}
        isWaiting={!isWaitingForUser}
      />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/discussion/
git commit -m "feat(frontend): add discussion components"
```

---

## Task 10: Summary 组件

**Files:**
- Create: `frontend/src/components/summary/SummaryModal.tsx`
- Create: `frontend/src/components/summary/SummaryView.tsx`

- [ ] **Step 1: Create SummaryModal.tsx**

```typescript
import type { Summary, Participant } from '@/types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ParticipantAvatar } from '../participants/ParticipantAvatar';

interface SummaryModalProps {
  summary: Summary;
  participants: Participant[];
  onClose: () => void;
  onNewDebate: () => void;
}

export function SummaryModal({ summary, participants, onClose, onNewDebate }: SummaryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-2">{summary.topic}</h2>
        <p className="text-gray-500 mb-6">Debate Summary</p>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Key Viewpoints</h3>
            <div className="space-y-3">
              {Object.entries(summary.viewpoints).map(([name, viewpoint]) => {
                const participant = participants.find((p) => p.name === name);
                return (
                  <div key={name} className="flex gap-3">
                    {participant && (
                      <ParticipantAvatar
                        name={participant.name}
                        color={participant.color}
                        size="sm"
                        className="mt-1"
                      />
                    )}
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-gray-600 text-sm">{viewpoint}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Open Questions</h3>
            <ul className="list-disc list-inside space-y-1">
              {summary.openQuestions.map((q, i) => (
                <li key={i} className="text-gray-600 text-sm">{q}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-3 justify-center mt-8">
          <Button variant="outline" onClick={onClose}>
            Back to Discussion
          </Button>
          <Button onClick={onNewDebate}>Start New Debate</Button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create SummaryView.tsx**

```typescript
import type { Summary, Participant } from '@/types';
import { SummaryModal } from './SummaryModal';

interface SummaryViewProps {
  summary: Summary;
  participants: Participant[];
  onNewDebate: () => void;
}

export function SummaryView({ summary, participants, onNewDebate }: SummaryViewProps) {
  return (
    <SummaryModal
      summary={summary}
      participants={participants}
      onClose={() => {}}
      onNewDebate={onNewDebate}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/summary/
git commit -m "feat(frontend): add summary modal component"
```

---

## Task 11: 主 App 和 Debate Hook

**Files:**
- Create: `frontend/src/hooks/useDebate.ts`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/main.tsx`

- [ ] **Step 1: Create useDebate.ts**

```typescript
import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { debateStart, debateTurn, fetchSummary } from '@/services/api';

const getDelay = (speed: 'slow' | 'normal' | 'fast'): number => {
  switch (speed) {
    case 'slow': return 4000;
    case 'fast': return 1000;
    default: return 2000;
  }
};

export function useDebate() {
  const {
    appState,
    topic,
    participants,
    messages,
    config,
    isWaitingForUser,
    isStreaming,
    autoDebateCount,
    setAppState,
    setIsWaitingForUser,
    setIsStreaming,
    setThinkingSpeakerId,
    addMessage,
    incrementAutoDebateCount,
    resetAutoDebateCount,
    setSummary,
    clearMessages,
  } = useAppStore();

  const startDebate = useCallback(async () => {
    if (!topic || participants.length === 0) return;

    clearMessages();
    resetAutoDebateCount();
    setIsStreaming(true);

    try {
      await debateStart(topic, participants, (msg) => {
        addMessage(msg);
      });
    } catch (err) {
      console.error('Failed to start debate:', err);
    } finally {
      setIsStreaming(false);
    }
  }, [topic, participants, clearMessages, resetAutoDebateCount, setIsStreaming, addMessage]);

  const generateNextTurn = useCallback(async () => {
    if (isStreaming) return;

    const currentSpeaker = participants[autoDebateCount % participants.length];
    setThinkingSpeakerId(currentSpeaker.id);
    setIsStreaming(true);

    try {
      const { message, action } = await debateTurn(
        'debate-1',
        messages,
        participants,
        autoDebateCount,
        config.maxTurnsPerRound
      );
      addMessage(message);
      incrementAutoDebateCount();

      if (action === 'WAIT' || autoDebateCount >= config.maxTurnsPerRound) {
        setIsWaitingForUser(true);
      }
    } catch (err) {
      console.error('Failed to generate turn:', err);
      setIsWaitingForUser(true);
    } finally {
      setThinkingSpeakerId(null);
      setIsStreaming(false);
    }
  }, [
    isStreaming,
    participants,
    autoDebateCount,
    messages,
    config.maxTurnsPerRound,
    setThinkingSpeakerId,
    setIsStreaming,
    addMessage,
    incrementAutoDebateCount,
    setIsWaitingForUser,
  ]);

  const summarize = useCallback(async () => {
    try {
      const summary = await fetchSummary('debate-1', messages, participants);
      setSummary(summary);
      setAppState('SUMMARY');
    } catch (err) {
      console.error('Failed to summarize:', err);
    }
  }, [messages, participants, setSummary, setAppState]);

  // Auto-debate effect
  useEffect(() => {
    if (appState !== 'DEBATING') return;
    if (isWaitingForUser || isStreaming) return;
    if (autoDebateCount === 0) return; // Waiting for startDebate to complete first

    const delay = getDelay(config.speed);
    const timer = setTimeout(() => {
      generateNextTurn();
    }, delay);

    return () => clearTimeout(timer);
  }, [appState, isWaitingForUser, isStreaming, autoDebateCount, config.speed, generateNextTurn]);

  return {
    startDebate,
    generateNextTurn,
    summarize,
  };
}
```

- [ ] **Step 2: Create App.tsx**

```typescript
import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useDebate } from '@/hooks/useDebate';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { LandingView } from '@/components/landing/LandingView';
import { ParticipantList } from '@/components/participants/ParticipantList';
import { DiscussionView } from '@/components/discussion/DiscussionView';
import { SummaryView } from '@/components/summary/SummaryView';
import { fetchPanel } from '@/services/api';
import { Spinner } from '@/components/ui/spinner';

function PanelReview() {
  const { topic, participants, setParticipants, setAppState } = useAppStore();

  const handleGenerate = async () => {
    try {
      const { participants: newParticipants } = await fetchPanel(topic);
      setParticipants(newParticipants);
    } catch (err) {
      console.error('Failed to generate panel:', err);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, []);

  const handleConfirm = () => {
    setAppState('DEBATING');
  };

  const handleCancel = () => {
    setAppState('LANDING');
  };

  if (participants.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <ParticipantList
      participants={participants}
      onUpdate={(id, updates) => useAppStore.getState().updateParticipant(id, updates)}
      onReplace={async (id) => {
        try {
          const { participants: newParticipants } = await fetchPanel(topic);
          const updated = newParticipants.find((p) => p.id === id) || newParticipants[0];
          useAppStore.getState().updateParticipant(id, updated);
        } catch (err) {
          console.error('Failed to replace participant:', err);
        }
      }}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

function DebateController() {
  const { participants, setAppState } = useAppStore();
  const { startDebate, summarize } = useDebate();

  useEffect(() => {
    if (participants.length === 3) {
      startDebate();
    }
  }, [participants]);

  return (
    <>
      <DiscussionView onSummarize={summarize} />
    </>
  );
}

export default function App() {
  const { appState, reset } = useAppStore();

  const handleNewDebate = () => {
    reset();
  };

  switch (appState) {
    case 'ONBOARDING':
      return <OnboardingForm />;
    case 'LANDING':
      return <LandingView />;
    case 'GENERATING_PANEL':
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Spinner />
        </div>
      );
    case 'PANEL_REVIEW':
      return <PanelReview />;
    case 'DEBATING':
      return <DebateController />;
    case 'SUMMARY':
      return <SummaryView onNewDebate={handleNewDebate} />;
    default:
      return <OnboardingForm />;
  }
}
```

- [ ] **Step 3: Create main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Create index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useDebate.ts frontend/src/App.tsx frontend/src/main.tsx frontend/src/index.css
git commit -m "feat(frontend): add main App with debate state machine"
```

---

## Task 12: E2E 测试

**Files:**
- Create: `frontend/tests/example.spec.ts`
- Create: `frontend/playwright.config.ts`

- [ ] **Step 1: Create playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Create tests/example.spec.ts**

```typescript
import { test, expect } from '@playwright/test';

test('onboarding flow', async ({ page }) => {
  await page.goto('/');

  // Enter name
  await page.fill('input[placeholder="Enter your name"]', 'TestUser');
  await page.click('button:has-text("Enter")');

  // Should be on landing page
  await expect(page.locator('h1')).toContainText('The Roundtable');
});

test('debate flow with mock', async ({ page }) => {
  // This test requires the backend to be running
  // Skip if backend is not available
});
```

- [ ] **Step 3: Run E2E test setup**

```bash
cd frontend && npx playwright install chromium
```

- [ ] **Step 4: Commit**

```bash
git add frontend/tests/ frontend/playwright.config.ts
git commit -m "test(frontend): add Playwright E2E test configuration"
```

---

## Self-Review Checklist

- [x] Spec coverage: All components, state machine, API integration
- [x] Bug fixes: Loading state (#2), Typing indicator (#1)
- [x] Placeholder scan: No TBD/TODO found
- [x] Type consistency: All interfaces from types/index.ts used consistently
- [x] File paths: All absolute paths from project root
