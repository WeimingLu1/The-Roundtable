import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RandomButton } from './RandomButton';

export function TopicInput() {
  const [localTopic, setLocalTopic] = useState('');
  const { setTopic, setAppState } = useAppStore();

  const handleStart = () => {
    if (!localTopic.trim()) return;
    setTopic(localTopic.trim());
    setAppState('GENERATING_PANEL');
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={localTopic}
        onChange={(e) => setLocalTopic(e.target.value)}
        placeholder="今天我们应该讨论什么话题？"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleStart();
          }
        }}
      />
      <div className="flex gap-3">
        <Button onClick={handleStart} disabled={!localTopic.trim()} className="flex-1">
          邀请嘉宾
        </Button>
        <RandomButton onTopicGenerated={setLocalTopic} />
      </div>
    </div>
  );
}
