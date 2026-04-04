import { useState, useCallback } from 'react';

export function useStreamingMessage() {
  const [displayText, setDisplayText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = useCallback(async (generateFn: () => Promise<string>) => {
    setIsStreaming(true);
    setDisplayText('');

    const fullText = await generateFn();

    // Animate character by character
    for (let i = 0; i < fullText.length; i++) {
      await new Promise(r => setTimeout(r, 15 + Math.random() * 20));
      setDisplayText(fullText.slice(0, i + 1));
    }

    setIsStreaming(false);
    return fullText;
  }, []);

  return { displayText, isStreaming, startStream };
}
