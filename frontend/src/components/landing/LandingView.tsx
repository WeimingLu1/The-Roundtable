import { motion } from 'framer-motion';
import { TopicInput } from './TopicInput';

export function LandingView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">The Roundtable</h1>
          <p className="text-purple-200 text-lg">
            Enter a topic and summon three AI personas to debate it
          </p>
        </div>
        <TopicInput />
      </motion.div>
    </div>
  );
}
