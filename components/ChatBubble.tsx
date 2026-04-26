import React, { useMemo } from 'react';
import { Message, Participant } from '../types';
import { ThumbsUp, ThumbsDown, GitBranch, Minus, Hand } from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
  sender?: Participant;
  participants: Participant[]; // Needed for mention highlighting
  hostName?: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, sender, participants, hostName }) => {
  const isUser = message.senderId === 'user';

  const sortedNames = useMemo(
    () => participants.map(p => p.name).sort((a, b) => b.length - a.length),
    [participants]
  );

  // Helper to escape characters for Regex
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // 1. First Pass: Handle @Mentions
  const parseMentions = (text: string): React.ReactNode[] => {
      const hostAliases = ['Host', 'User'];
      if (hostName) hostAliases.push(hostName);
      hostAliases.sort((a, b) => b.length - a.length);

      const allTargets = [...sortedNames, ...hostAliases].map(name => escapeRegExp(name));
      
      const pattern = `(@(?:${allTargets.join('|')}))`;
      const regex = new RegExp(pattern, 'gi');

      const parts = text.split(regex); 
      
      return parts.map((part, i) => {
          if (part.startsWith('@')) {
              const rawName = part.substring(1); // Remove @
              
              // Check Guests
              const target = participants.find(p => p.name.toLowerCase() === rawName.toLowerCase());
              if (target) {
                  return (
                      <span 
                        key={`mention-${i}`} 
                        className="font-bold px-1.5 py-0.5 rounded mx-0.5 text-xs align-baseline border border-opacity-40 shadow-sm whitespace-nowrap inline-block" 
                        style={{ 
                            color: target.color, 
                            backgroundColor: `${target.color}25`,
                            borderColor: target.color 
                        }}
                      >
                          {part}
                      </span>
                  );
              }

              // Check Host
              const isHostMention = hostAliases.some(alias => alias.toLowerCase() === rawName.toLowerCase());
              if (isHostMention) {
                   return (
                    <span key={`mention-${i}`} className={`font-bold px-1.5 py-0.5 rounded mx-0.5 text-xs shadow-sm whitespace-nowrap inline-block border
                        ${isUser 
                            ? 'text-black bg-white/20 border-black/10' 
                            : 'text-white bg-[#424242] border-gray-500' // Explicit gray highlight for AI mentioning user
                        }
                    `}>
                        {part}
                    </span>
                   );
              }
          }
          return part;
      });
  };

  // 2. Second Pass: Handle **Bold** Markdown (Applied recursively on text parts)
  const renderRichText = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*)/g); // Split by **bold** text
      
      return parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
              // It's bold text, strip asterisks and parse mentions inside
              const content = part.slice(2, -2);
              return (
                  <strong key={index} className={`${isUser ? 'text-black' : 'text-white'} font-bold`}>
                      {parseMentions(content)}
                  </strong>
              );
          } else {
              // It's regular text, just parse mentions
              return <React.Fragment key={index}>{parseMentions(part)}</React.Fragment>;
          }
      });
  };

  const renderStanceBadge = () => {
    if (!message.stance || message.stance === 'NEUTRAL') return null;

    let colorClass = 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    let icon = <Minus size={10} />;
    let text = message.stance;
    const intensity = message.stanceIntensity || 3;

    // Helper for intensity adjectives
    const getAdjective = (val: number) => {
        if (val >= 5) return "Strongly ";
        if (val <= 2) return "Slightly ";
        return "";
    }

    switch (message.stance) {
        case 'AGREE':
            colorClass = 'bg-green-500/20 text-green-400 border-green-500/30';
            icon = <ThumbsUp size={10} />;
            text = `${getAdjective(intensity)}Agrees`;
            break;
        case 'DISAGREE':
            colorClass = 'bg-red-500/20 text-red-400 border-red-500/30';
            icon = <ThumbsDown size={10} />;
            text = `${getAdjective(intensity)}Disagrees`;
            break;
        case 'PARTIAL':
            colorClass = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            icon = <Hand size={10} />;
            text = 'Partially Agrees';
            break;
        case 'PIVOT':
            colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            icon = <GitBranch size={10} />;
            text = 'Shifting Topic';
            break;
    }

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider mb-2 border ${colorClass}`}>
            {icon}
            <span>{text}</span>
        </div>
    );
  };

  const initials = sender?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || '??';

  if (isUser) {
    return (
      <div className="flex justify-end mb-6 animate-fade-in-up">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-md-accent text-black rounded-3xl rounded-tr-sm p-5 shadow-elevation-1">
             <p className="text-base font-medium leading-relaxed font-sans whitespace-pre-wrap">
                 {renderRichText(message.text)}
             </p>
          </div>
          <div className="text-right mt-1 mr-1">
             <span className="text-[10px] font-bold uppercase tracking-widest text-md-outline">You (Host)</span>
          </div>
        </div>
      </div>
    );
  }

  // Expert (Guest)
  return (
    <div className="flex justify-start mb-6 animate-fade-in-up group items-end gap-3">
      {/* Avatar */}
      <div 
        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm mb-4 border border-white/10"
        style={{ backgroundColor: sender?.color || '#333' }}
      >
        {initials}
      </div>

      <div className="max-w-[85%] md:max-w-[75%]">
        <div className="bg-md-surface-container-low p-5 rounded-3xl rounded-tl-none border border-white/5 shadow-elevation-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
             <span className="font-bold text-sm" style={{ color: sender?.color }}>{sender?.name}</span>
             <span className="text-[10px] text-md-outline uppercase opacity-80 leading-tight">{sender?.title}</span>
          </div>
          
          {/* Stance Badge */}
          {renderStanceBadge()}

          <div className="text-md-primary text-base leading-relaxed font-sans whitespace-pre-wrap">
            {renderRichText(message.text)}
          </div>
        </div>
      </div>
    </div>
  );
};