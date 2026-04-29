import React, { useMemo, useCallback } from 'react';
import { Message, Participant } from '../types';
import { ThumbsUp, ThumbsDown, GitBranch, Minus, Hand, Lightbulb, MessageCircle, AlertTriangle, Flag, PlusCircle, HelpCircle, Zap } from 'lucide-react';

// Helper to escape characters for Regex - moved outside component
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

interface ChatBubbleProps {
  message: Message;
  sender?: Participant;
  participants: Participant[]; // Needed for mention highlighting
  hostName?: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, sender, participants, hostName }) => {
  const isUser = message.senderId === 'user';

  const sortedNames = useMemo(
    () => {
      if (!participants || participants.length === 0) return [];
      return participants.map(p => p.name).sort((a, b) => b.length - a.length);
    },
    [participants]
  );

  // 1. First Pass: Handle @Mentions
  const parseMentions = useCallback((text: string): React.ReactNode[] => {
      const hostAliases = ['Host', 'User'];
      if (hostName) hostAliases.push(hostName);
      hostAliases.sort((a, b) => b.length - a.length);

      const allTargets = [...sortedNames, ...hostAliases].map(name => escapeRegExp(name));
      
      // Use matchAll + manual reconstruction instead of split() to correctly preserve @mention text
      // split() with non-capturing group removes @mention entirely; split() with capturing group
      // puts only the captured name (without @) in the result, breaking startsWith('@') check.
      const pattern = `@(${allTargets.join('|')})`;
      const regex = new RegExp(pattern, 'gi');

      const result: React.ReactNode[] = [];
      let lastIndex = 0;

      for (const match of text.matchAll(regex)) {
        const matchText = match[0]; // Full match including @ (e.g., "@Alice")
        const rawName = match[1];   // Captured name (e.g., "Alice") for lookup
        const matchIndex = match.index!;

        // Add text before the match
        if (matchIndex > lastIndex) {
          result.push(text.slice(lastIndex, matchIndex));
        }

        // Find the target participant or check host aliases
        const target = participants.find(p => p.name.toLowerCase() === rawName.toLowerCase());
        if (target) {
          result.push(
            <span
              key={`mention-${matchIndex}`}
              className="font-bold px-1.5 py-0.5 rounded mx-0.5 text-xs align-baseline border border-opacity-40 shadow-sm whitespace-nowrap inline-block"
              style={{
                color: target.color,
                backgroundColor: `${target.color}25`,
                borderColor: target.color
              }}
            >
              {matchText}
            </span>
          );
        } else {
          const isHostMention = hostAliases.some(alias => alias.toLowerCase() === rawName.toLowerCase());
          if (isHostMention) {
            result.push(
              <span key={`mention-${matchIndex}`} className={`font-bold px-1.5 py-0.5 rounded mx-0.5 text-xs shadow-sm whitespace-nowrap inline-block border
                ${isUser
                  ? 'text-black bg-white/20 border-black/10'
                  : 'text-white bg-[#424242] border-gray-500'
              }`}>
                {matchText}
              </span>
            );
          } else {
            // Unknown mention - render as plain text with @
            result.push(matchText);
          }
        }

        lastIndex = matchIndex + matchText.length;
      }

      // Add remaining text after last match
      if (lastIndex < text.length) {
        result.push(text.slice(lastIndex));
      }

      return result;
  }, [sortedNames, participants, hostName, isUser]);

  // 2. Second Pass: Handle **Bold** Markdown (Applied recursively on text parts)
  const renderRichText = useCallback((text: string) => {
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
  }, [parseMentions, isUser]);

  const renderStanceBadge = () => {
    if (!message.stance || message.stance === 'NEUTRAL') return null;

    let colorClass = 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    let icon = <Minus size={10} />;
    let text = message.stance;
    const intensity = message.stanceIntensity ?? 3;

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
        case 'SURPRISED':
            colorClass = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            icon = <Zap size={10} />;
            text = 'Surprised';
            break;
        case 'INTRIGUED':
            colorClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            icon = <Lightbulb size={10} />;
            text = 'Intrigued';
            break;
        case 'CHALLENGED':
            colorClass = 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            icon = <AlertTriangle size={10} />;
            text = 'Challenged';
            break;
        case 'CONCEDE':
            colorClass = 'bg-teal-500/20 text-teal-400 border-teal-500/30';
            icon = <Flag size={10} />;
            text = 'Concedes';
            break;
        case 'BUILD_ON':
            colorClass = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
            icon = <MessageCircle size={10} />;
            text = 'Building On';
            break;
        case 'CLARIFY':
            colorClass = 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
            icon = <PlusCircle size={10} />;
            text = 'Clarifying';
            break;
        case 'QUESTION':
            colorClass = 'bg-pink-500/20 text-pink-400 border-pink-500/30';
            icon = <HelpCircle size={10} />;
            text = 'Questioning';
            break;
        default:
            return null;
    }

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider mb-2 border ${colorClass}`}>
            {icon}
            <span>{text}</span>
        </div>
    );
  };

  const initials = (sender?.name || '')
    .split(' ')
    .map(n => n[0] || '')
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
          {renderStanceBadge()}
          <div className="text-right mt-1 mr-1">
             <span className="text-[10px] font-bold uppercase tracking-widest text-md-outline">{hostName || 'You'} (Host)</span>
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