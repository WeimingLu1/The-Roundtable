import React from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface OnboardingFormProps {
  onComplete: (context: { nickname: string; identity: string; language: 'Chinese' | 'English' | 'Japanese' | 'Spanish' }) => void;
}

export function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const setUser = useAppStore((s) => s.setUser);
  const [nickname, setNickname] = React.useState('');
  const [identity, setIdentity] = React.useState('');
  const [language, setLanguage] = React.useState<'Chinese' | 'English' | 'Japanese' | 'Spanish'>('English');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    const context = { nickname, identity, language };
    setUser(context);
    onComplete(context);
  };

  return (
    <Card className="w-full max-w-md p-8">
      <h2 className="text-2xl font-bold mb-6">Welcome to The Roundtable</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Your Name</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
            placeholder="Enter your name"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Who are you?</label>
          <input
            type="text"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
            placeholder="e.g., Curious thinker, Tech enthusiast"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
          >
            <option value="English">English</option>
            <option value="Chinese">中文</option>
            <option value="Japanese">日本語</option>
            <option value="Spanish">Español</option>
          </select>
        </div>
        <Button type="submit" className="w-full">Continue</Button>
      </form>
    </Card>
  );
}
