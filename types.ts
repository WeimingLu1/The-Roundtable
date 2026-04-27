
export type RoleType = 'host' | 'expert' | 'user';

export interface Participant {
  id: string;
  name: string;
  roleType: RoleType;
  title: string;
  stance: string;
  color: string; // Hex code for avatar background
}

export interface UserContext {
  nickname: string;
  identity: string;
  language: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isInterruption?: boolean;
  stance?: string; // 'AGREE' | 'DISAGREE' | 'PARTIAL' | 'PIVOT' | 'NEUTRAL'
  stanceIntensity?: number; // 1 (Weak) to 5 (Strong)
}

export enum AppState {
  ONBOARDING = 'ONBOARDING',
  LANDING = 'LANDING',
  GENERATING_PANEL = 'GENERATING_PANEL',
  PANEL_REVIEW = 'PANEL_REVIEW',
  OPENING_STATEMENTS = 'OPENING_STATEMENTS', 
  DISCUSSION = 'DISCUSSION',
}

export interface Summary {
  topic: string;
  summary: string;  // narrative overview
  core_viewpoints: Array<{
    speaker: string;
    title: string;
    stance: string;
    key_points: string[];
    most_memorable_quote: string;
  }>;
  key_discussion_moments: string[];
  questions: Array<{ question: string; why_unresolved: string }>;
  conclusion: string;
}