
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
  core_viewpoints: Array<{ speaker: string, point: string }>;
  questions: string[];
}