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
