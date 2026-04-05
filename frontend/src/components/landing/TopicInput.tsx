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
