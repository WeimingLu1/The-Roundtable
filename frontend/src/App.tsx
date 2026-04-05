import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useDebate } from '@/hooks/useDebate';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { LandingView } from '@/components/landing/LandingView';
import { ParticipantList } from '@/components/participants/ParticipantList';
import { DiscussionView } from '@/components/discussion/DiscussionView';
import { SummaryView } from '@/components/summary/SummaryView';
import { fetchPanel } from '@/services/api';
import { Spinner } from '@/components/ui/spinner';

function GeneratingPanel() {
  const { topic, setParticipants, setAppState } = useAppStore();

  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      try {
        const { participants: newParticipants } = await fetchPanel(topic);

        // Check if we were cancelled or if app state changed
        if (cancelled) return;

        const currentState = useAppStore.getState().appState;
        if (currentState !== 'GENERATING_PANEL') return;

        setParticipants(newParticipants);
        setAppState('PANEL_REVIEW');
      } catch (err) {
        if (cancelled) return;
        setAppState('LANDING');
      }
    };
    generate();

    return () => {
      cancelled = true;
    };
  }, [topic]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center">
        <Spinner className="h-8 w-8 mx-auto mb-4 text-white" />
        <p className="text-white text-lg">Summoning guests...</p>
      </div>
    </div>
  );
}

function PanelReview() {
  const { topic, participants, setAppState } = useAppStore();

  const handleConfirm = () => {
    setAppState('DEBATING');
  };

  const handleCancel = () => {
    setAppState('LANDING');
  };

  return (
    <ParticipantList
      participants={participants}
      topic={topic}
      onUpdate={(id, updates) => useAppStore.getState().updateParticipant(id, updates)}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

function DebateController() {
  const { participants } = useAppStore();
  const { startDebate, summarize } = useDebate();

  useEffect(() => {
    if (participants.length === 3) {
      startDebate();
    }
  }, [participants, startDebate]);

  return (
    <>
      <DiscussionView onSummarize={summarize} />
    </>
  );
}

export default function App() {
  const { appState, reset, setAppState } = useAppStore();

  const handleNewDebate = () => {
    reset();
  };

  switch (appState) {
    case 'ONBOARDING':
      return <OnboardingForm />;
    case 'LANDING':
      return <LandingView />;
    case 'GENERATING_PANEL':
      return <GeneratingPanel />;
    case 'PANEL_REVIEW':
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <PanelReview />
        </div>
      );
    case 'DEBATING':
      return <DebateController />;
    case 'SUMMARY':
      return <SummaryView onNewDebate={handleNewDebate} />;
    default:
      return <OnboardingForm />;
  }
}
