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
