import { useState } from 'react';
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

Summary:
${summary.summary || ''}

Core Viewpoints:
${summary.core_viewpoints.map(vp => `
【${vp.speaker}】${vp.title}
立场: ${vp.stance}
关键观点:
${(vp.key_points || []).map(p => `  • ${p}`).join('\n')}
语录: "${vp.most_memorable_quote || ''}"
`).join('\n')}

Key Discussion Moments:
${(summary.key_discussion_moments || []).map((m, i) => `${i + 1}. ${m}`).join('\n')}

Open Questions:
${(summary.questions || []).map(q => `• ${q.question}\n  (未解决原因: ${q.why_unresolved || ''})`).join('\n')}

Conclusion:
${summary.conclusion || ''}
    `.trim();

    navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = async () => {
    const textToShare = `
【圆桌会议】${summary.topic}

概述: ${summary.summary || ''}

${summary.core_viewpoints.map(vp => `
• ${vp.speaker} (${vp.title}): ${vp.stance}
`).join('')}

结论: ${summary.conclusion || ''}
    `.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `圆桌会议: ${summary.topic}`,
          text: textToShare,
        });
      } catch (err) {
        // User cancelled or share failed, fall back to copy
        try {
          await navigator.clipboard.writeText(textToShare);
        } catch {
          console.error('Failed to copy to clipboard');
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(textToShare);
      } catch {
        console.error('Failed to copy to clipboard');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-md-surface-container w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
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

          {summary.summary && (
            <div>
              <h4 className="text-xs font-bold text-md-outline uppercase tracking-widest mb-2">Overview</h4>
              <p className="text-md-primary text-sm leading-relaxed">{summary.summary}</p>
            </div>
          )}

          {summary.core_viewpoints && summary.core_viewpoints.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-md-outline uppercase tracking-widest mb-3">Core Viewpoints</h4>
              <div className="space-y-4">
                {summary.core_viewpoints.map((item, i) => (
                  <div key={i} className="bg-md-surface-container-low p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="block text-sm font-bold text-md-primary">{item?.speaker ?? 'Unknown'}</span>
                        <span className="text-xs text-md-secondary">{item?.title ?? ''}</span>
                      </div>
                      {item?.stance && (
                        <span className="text-xs bg-md-accent/20 text-md-accent px-2 py-0.5 rounded-full font-medium">
                          {item.stance}
                        </span>
                      )}
                    </div>
                    {(item?.key_points || []).length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {(item.key_points || []).map((point, pi) => (
                          <li key={pi} className="text-xs text-md-secondary flex gap-2">
                            <span className="text-md-accent">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {item?.most_memorable_quote && (
                      <p className="mt-2 text-xs italic text-md-secondary/80 border-l-2 border-md-accent pl-2">
                        "{item.most_memorable_quote}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.key_discussion_moments && summary.key_discussion_moments.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-md-outline uppercase tracking-widest mb-3">Key Discussion Moments</h4>
              <ul className="space-y-2">
                {summary.key_discussion_moments.map((moment, i) => (
                  <li key={i} className="flex gap-2 text-md-secondary text-sm">
                    <span className="text-md-accent font-bold">{i + 1}.</span>
                    <span>{moment}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.questions && summary.questions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-md-outline uppercase tracking-widest mb-3">Open Questions</h4>
              <ul className="space-y-3">
                {summary.questions.map((item, i) => (
                  <li key={i} className="bg-md-surface-container-low p-3 rounded-xl border border-white/5">
                    <div className="flex gap-2 text-md-primary text-sm mb-1">
                      <span className="text-md-accent font-bold">Q{i + 1}:</span>
                      <span>{item?.question ?? ''}</span>
                    </div>
                    {item?.why_unresolved && (
                      <p className="text-xs text-md-secondary italic ml-5">未解决: {item.why_unresolved}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.conclusion && (
            <div>
              <h4 className="text-xs font-bold text-md-outline uppercase tracking-widest mb-2">Conclusion</h4>
              <p className="text-md-primary text-sm leading-relaxed italic">{summary.conclusion}</p>
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
           <button onClick={handleShare} className="flex-1 py-3 flex justify-center items-center gap-2 bg-md-accent text-black rounded-xl font-medium text-sm hover:opacity-90">
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>
    </div>
  );
};
