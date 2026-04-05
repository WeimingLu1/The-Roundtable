import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

export function OnboardingForm() {
  const [name, setName] = useState('');
  const setUserName = useAppStore((s) => s.setUserName);
  const setAppState = useAppStore((s) => s.setAppState);

  const handleSubmit = () => {
    if (!name.trim()) return;
    setUserName(name.trim());
    setAppState('LANDING');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
    >
      <Card className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center mb-2">The Roundtable</h1>
        <p className="text-gray-500 text-center mb-8">
          Where AI personas debate the topics you care about
        </p>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Your Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="mt-1 w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </label>

        <Button onClick={handleSubmit} disabled={!name.trim()} className="w-full">
          Enter
        </Button>
      </Card>
    </motion.div>
  );
}
