import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { listDiscussions, DiscussionSummary } from '../services/discussionService';
import { ArrowLeft, MessageCircle, Clock, Loader2 } from 'lucide-react';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function HistoryList() {
  const { user, loading: authLoading } = useAuth();
  const [discussions, setDiscussions] = useState<DiscussionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { navigate('/login'); return; }
    if (!user) return;
    listDiscussions()
      .then(setDiscussions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const participantNames = (d: DiscussionSummary) =>
    (d.participants || []).map(p => p.name).join(', ') || 'No participants';

  return (
    <div className="min-h-screen bg-md-surface p-6 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-white/10 text-md-primary">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-md-primary">Past Discussions</h1>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-md-accent" size={32} />
          </div>
        ) : error ? (
          <div className="text-center p-12 text-red-400">{error}</div>
        ) : discussions.length === 0 ? (
          <div className="text-center p-12">
            <p className="text-md-secondary text-lg mb-4">No discussions yet.</p>
            <button onClick={() => navigate('/')}
              className="px-6 py-3 bg-md-accent text-black rounded-full font-medium text-sm hover:opacity-90">
              Start your first roundtable
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {discussions.map(d => (
              <button
                key={d.id}
                onClick={() => navigate(`/discussion/${d.id}`)}
                className="w-full text-left bg-md-surface-container rounded-2xl p-5 border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all shadow-sm"
              >
                <h3 className="font-bold text-md-primary text-lg mb-1">{d.topic}</h3>
                <p className="text-sm text-md-secondary mb-3 truncate">{participantNames(d)}</p>
                <div className="flex items-center gap-4 text-xs text-md-outline">
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {d.message_count} msgs</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {relativeTime(d.updated_at)}</span>
                  {d.status === 'active' && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold uppercase">Active</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
