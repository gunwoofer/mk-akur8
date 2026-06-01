"use client";

import { motion } from "framer-motion";

export default function SuccessStep({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-8 text-center gap-5">
      <motion.div
        initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
        className="text-7xl"
      >
        🏆
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-2"
      >
        <p className="text-white font-black text-2xl tracking-tight">GP Submitted!</p>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
          Ratings are recalculating. The dashboard will update live.
        </p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        onClick={onReset}
        whileTap={{ scale: 0.97 }}
        className="mt-2 px-6 py-3 bg-[#161616] border border-[#252525] text-white rounded-2xl font-semibold text-sm hover:border-[#333] transition-colors"
      >
        Submit Another GP
      </motion.button>
    </div>
  );
}
