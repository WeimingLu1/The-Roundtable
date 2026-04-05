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
          <h1 className="text-5xl font-bold text-white mb-2">圆桌讨论</h1>
          <p className="text-purple-200 text-lg">
            输入一个话题，邀请三位AI嘉宾展开辩论
          </p>
        </div>
        <TopicInput />
      </motion.div>
    </div>
  );
}
