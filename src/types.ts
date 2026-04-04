export type RoleType = 'host' | 'expert' | 'user';

export interface Participant {
  id: string;
  name: string;
  roleType: RoleType;
  title: string;
  stance: string;
  color: string;
  avatarUrl?: string;
}

export interface UserContext {
  nickname: string;
  identity: string;
  language: 'Chinese' | 'English' | 'Japanese' | 'Spanish';
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isInterruption?: boolean;
  stance?: 'AGREE' | 'DISAGREE' | 'PARTIAL' | 'PIVOT' | 'NEUTRAL';
  stanceIntensity?: number;
}

export type AppState =
  | 'ONBOARDING'
  | 'LANDING'
  | 'GENERATING_PANEL'
  | 'PANEL_REVIEW'
  | 'OPENING_STATEMENTS'
  | 'DISCUSSION';

export interface Summary {
  topic: string;
  core_viewpoints: Array<{ speaker: string; point: string }>;
  questions: string[];
}

export interface SavedDiscussion {
  id: string;
  title: string;
  topic: string;
  participants: Participant[];
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  summary?: Summary;
}
