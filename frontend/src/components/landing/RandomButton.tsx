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
