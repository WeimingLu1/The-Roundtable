import React, { useState } from 'react';
import { Participant } from '../types';
import { Check, RotateCw, UserRoundPlus, Loader2, X } from 'lucide-react';

interface ParticipantCardProps {
  participant: Participant;
  isCompact?: boolean;
  isSwapping?: boolean;
  onUpdate?: (id: string, newName: string) => void;
  onReplace?: (id: string, newName: string) => void;
  onStartSwap?: (id: string) => void;
  isUpdating?: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({ 
    participant, 
    isCompact = false, 
    isSwapping = false,
    onUpdate, 
    onReplace,
    onStartSwap,
    isUpdating = false 
}) => {
  const [swapName, setSwapName] = useState('');

  // Generate Initials - guard against empty name
  const initials = (participant.name || '??')
    .split(' ')
    .map(n => n[0] || '')
    .join('')
    .substring(0, 2)
    .toUpperCase() || '??';

  const handleSwapSubmit = () => {
      if (swapName.trim() && onReplace) {
          onReplace(participant.id, swapName.trim());
          setSwapName('');
          setIsSwapping(false);
      }
  }

  // Width is now fixed (approx 220px) to prevent overflow issues on small screens while ensuring 3 cards fit well with scrolling
  return (
    <div className={`
      relative flex flex-col items-center bg-md-surface-container rounded-3xl shadow-elevation-1 border border-white/10 snap-center shrink-0 transition-all duration-300
      ${isCompact ? 'w-[120px] p-4' : 'w-[240px] p-6 py-8'}
      ${isUpdating ? 'opacity-70 scale-[0.98]' : 'opacity-100'}
    `}>
        {isUpdating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 rounded-3xl backdrop-blur-[1px]">
                <Loader2 className="animate-spin text-md-accent" size={32} />
            </div>
        )}

      {/* Avatar */}
      <div 
        className={`rounded-full flex items-center justify-center font-bold text-white shadow-inner mb-4 flex-shrink-0 border-2 border-md-surface transition-colors duration-500
            ${isCompact ? 'w-14 h-14 text-lg' : 'w-20 h-20 text-2xl'}
        `}
        style={{ backgroundColor: participant.color }}
      >
        {initials}
      </div>

      {/* Name Area */}
      {isSwapping && !isCompact ? (
          <div className="flex flex-col items-center gap-2 w-full animate-fade-in">
              <input 
                value={swapName}
                onChange={(e) => setSwapName(e.target.value)}
                placeholder="Who to invite?"
                className="w-full text-center border-b-2 border-md-accent outline-none bg-transparent font-medium text-md-primary text-base placeholder-gray-500 pb-1"
                autoFocus
              />
              <div className="flex gap-2 mt-1">
                <button onClick={() => setSwapName('')} className="p-1 text-gray-400 hover:text-white"><X size={16} /></button>
                <button onClick={handleSwapSubmit} className="p-1 text-md-accent hover:text-white"><Check size={16} /></button>
              </div>
          </div>
      ) : (
        <div className="relative group w-full text-center">
             <h3 className={`font-bold text-md-primary truncate px-2 ${isCompact ? 'text-sm' : 'text-lg'}`}>
                {participant.name}
            </h3>
        </div>
      )}
      
      {!isSwapping && (
        <p className="text-xs text-md-secondary uppercase tracking-wide font-medium mt-1 text-center truncate w-full px-2">
            {participant.title}
        </p>
      )}

      {!isCompact && !isSwapping && (
        <>
            <div className="mt-4 p-3 bg-md-surface-container-low rounded-xl w-full flex-1 flex items-center justify-center border border-white/5 relative group/quote">
                <p className="text-sm text-md-secondary text-center italic leading-relaxed">
                "{participant.stance}"
                </p>
            </div>

            {/* Swap Button (Only visible if onReplace provided) */}
            {onStartSwap && (
                <button 
                    onClick={() => onStartSwap(participant.id)}
                    className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-md-accent hover:text-black transition-colors text-xs font-medium text-md-secondary group"
                >
                    <UserRoundPlus size={14} />
                    <span>Invite New Guest</span>
                </button>
            )}
        </>
      )}
    </div>
  );
};