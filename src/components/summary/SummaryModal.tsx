import React from 'react';
import type { Summary } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';

interface SummaryModalProps {
  summary?: Summary | null;
  onClose: () => void;
  isOpen?: boolean;
}

export function SummaryModal({ summary, onClose, isOpen }: SummaryModalProps) {
  const effectiveSummary = summary || ({} as Summary);
  const isVisible = isOpen || !!summary;

  if (!isVisible) return null;

  return (
    <Dialog open={isVisible} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Discussion Summary</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-lg mb-2">Topic</h3>
            <p>{effectiveSummary.topic || 'Loading...'}</p>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-2">Core Viewpoints</h3>
            <div className="space-y-3">
              {(effectiveSummary.core_viewpoints || []).map((cv, i) => (
                <Card key={i} className="p-3">
                  <p className="font-medium">{cv.speaker}</p>
                  <p className="text-sm text-muted-foreground">{cv.point}</p>
                </Card>
              ))}
            </div>
          </div>

          {effectiveSummary.questions && effectiveSummary.questions.length > 0 && (
            <div>
              <h3 className="font-bold text-lg mb-2">Open Questions</h3>
              <ul className="list-disc list-inside space-y-1">
                {effectiveSummary.questions.map((q, i) => (
                  <li key={i} className="text-sm">{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
