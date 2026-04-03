import React, { useState } from 'react';
import { Summary } from '../types';
import { X, Share2, Copy, Check } from 'lucide-react';

interface SummaryModalProps {
  summary: Summary | null;
  onClose: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({ summary, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!summary) return null;

  const handleCopy = () => {
    const textToCopy = `
Topic: ${summary.topic}

Core Viewpoints:
${summary.core_viewpoints.map(vp => `- ${vp.speaker}: ${vp.point}`).join('\n')}

Open Questions:
${summary.questions.map(q => `- ${q}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-md-surface-container w-full max-w-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-md-surface-container">
          <h3 className="font-bold text-lg text-md-primary">Roundtable Minutes</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full">
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        
        <div className="overflow-y-auto p-6 space-y-6">
          
          <div>
            <h4 className="text-xs font-bold text-md-outline uppercase tracking-widest mb-2">Topic</h4>
            <p className="text-md-primary font-medium text-lg leading-snug">{summary.topic}</p>
          </div>

          {summary.core_viewpoints && summary.core_viewpoints.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-md-outline uppercase tracking-widest mb-3">Core Viewpoints</h4>
              <div className="space-y-3">
                {summary.core_viewpoints.map((item, i) => (
                  <div key={i} className="bg-md-surface-container-low p-3 rounded-xl border border-white/5 shadow-sm">
                    <span className="block text-xs font-bold text-md-secondary mb-1">{item.speaker}</span>
                    <p className="text-sm text-md-primary leading-relaxed">{item.point}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

           {summary.questions && summary.questions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-md-outline uppercase tracking-widest mb-3">Open Questions</h4>
              <ul className="space-y-2">
                {summary.questions.map((item, i) => (
                  <li key={i} className="flex gap-2 text-md-secondary text-sm">
                    <span className="text-md-accent font-bold">?</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-white/5 bg-md-surface-container flex gap-2">
          <button 
            onClick={handleCopy}
            className="flex-1 py-3 flex justify-center items-center gap-2 bg-md-surface-container-low rounded-xl text-md-primary font-medium text-sm hover:bg-white/10 transition-colors"
          >
            {copied ? <Check size={16} className="text-green-500"/> : <Copy size={16} />} 
            {copied ? "Copied" : "Copy"}
          </button>
           <button className="flex-1 py-3 flex justify-center items-center gap-2 bg-md-accent text-black rounded-xl font-medium text-sm hover:opacity-90">
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>
    </div>
  );
};