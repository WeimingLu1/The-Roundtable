import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Clock, MessageSquare, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { storageService } from '@/services/storageService';
import { exportToMarkdown } from '@/services/exportService';
import type { SavedDiscussion } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ParticipantAvatar } from '@/components/participants/ParticipantAvatar';

interface HistoryListProps {
  onClose: () => void;
  onLoad: (id: string) => void;
}

export function HistoryList({ onClose, onLoad }: HistoryListProps) {
  const [discussions, setDiscussions] = useState<SavedDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const { deleteDiscussionFromDB } = useAppStore();

  useEffect(() => {
    loadDiscussions();
  }, []);

  async function loadDiscussions() {
    setLoading(true);
    const list = await storageService.listDiscussions();
    setDiscussions(list);
    setLoading(false);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (window.confirm('Delete this discussion?')) {
      await deleteDiscussionFromDB(id);
      await loadDiscussions();
    }
  }

  async function handleExport(disc: SavedDiscussion, e: React.MouseEvent) {
    e.stopPropagation();
    const md = exportToMarkdown(disc);
    await navigator.clipboard.writeText(md);
    alert('Discussion copied to clipboard!');
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Discussion History</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : discussions.length === 0 ? (
          <div className="text-center py-8 text-secondary">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No saved discussions yet.</p>
            <p className="text-sm mt-1">Start a new roundtable and save it to see it here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {discussions.map((disc) => (
              <motion.div
                key={disc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group"
              >
                <Card
                  className="p-4 cursor-pointer hover:bg-surface-hover transition-colors"
                  onClick={() => {
                    onLoad(disc.id);
                    onClose();
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{disc.topic}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-secondary">
                        <Clock className="w-3 h-3" />
                        {new Date(disc.createdAt).toLocaleDateString()}
                        <span>·</span>
                        <MessageSquare className="w-3 h-3" />
                        {disc.messages.length} messages
                      </div>
                      <div className="flex gap-1 mt-2">
                        {disc.participants.slice(0, 3).map((p) => (
                          <ParticipantAvatar key={p.id} participant={p} size="sm" />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleExport(disc, e)}
                        title="Copy to clipboard"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleDelete(disc.id, e)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-error" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          onLoad(disc.id);
                          onClose();
                        }}
                        title="Load"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
