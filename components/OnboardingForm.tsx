import React, { useState } from 'react';
import { UserContext } from '../types';
import { ArrowRight } from 'lucide-react';

interface OnboardingFormProps {
  onComplete: (context: UserContext) => void;
}

export const OnboardingForm: React.FC<OnboardingFormProps> = ({ onComplete }) => {
  const [nickname, setNickname] = useState('');
  const [identity, setIdentity] = useState('');
  const [language, setLanguage] = useState('Chinese');

  const handleSubmit = () => {
    if (!nickname.trim()) return;

    onComplete({
      nickname: nickname.trim(),
      identity: identity.trim() || 'A curious observer',
      language
    });
  };

  return (
    <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm bg-md-surface-container rounded-3xl shadow-elevation-2 p-8 border border-white/10">
        <div className="mb-8 text-center">
            <h1 className="font-sans text-3xl font-bold text-md-primary tracking-tight">The Roundtable</h1>
            <p className="text-md-secondary text-sm mt-2">Enter the circle of minds.</p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-md-outline uppercase tracking-wider mb-2 ml-1">Your Name</label>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-md-outline uppercase tracking-wider mb-2 ml-1">Your Identity</label>
            <textarea 
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="e.g. A Tech Ethics Professor concerned about AI alignment..."
              rows={3}
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none transition-all resize-none"
            />
            <p className="text-[10px] text-gray-500 mt-1 ml-1">This helps the AI tailor the debate to you.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-md-outline uppercase tracking-wider mb-2 ml-1">Language</label>
            <div className="relative">
                <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary text-base focus:ring-2 focus:ring-md-accent/50 outline-none appearance-none"
                >
                <option value="Chinese">中文 (Chinese)</option>
                <option value="English">English</option>
                <option value="Japanese">日本語 (Japanese)</option>
                <option value="Spanish">Español</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={!nickname.trim()}
          className="mt-8 w-full bg-md-accent text-black font-medium py-4 rounded-full shadow-elevation-1 hover:shadow-elevation-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Join Roundtable <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};