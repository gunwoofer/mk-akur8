"use client";

import { motion } from "framer-motion";

const POINTS_TABLE = [
  { pos: "1st", pts: 15 }, { pos: "2nd", pts: 12 }, { pos: "3rd", pts: 10 },
  { pos: "4th", pts: 9 },  { pos: "5th", pts: 8 },  { pos: "6th", pts: 7 },
  { pos: "7th", pts: 6 },  { pos: "8th", pts: 5 },  { pos: "9th", pts: 4 },
  { pos: "10th", pts: 3 }, { pos: "11th", pts: 2 },  { pos: "12th", pts: 1 },
  { pos: "13th–24th", pts: 0 },
];

export default function RankingInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-white font-black text-2xl italic tracking-tight">How Rankings Work</h2>
            <p className="text-gray-500 text-sm mt-0.5">Bayesian Average Rating system</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white text-2xl transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* Step 1 — Points */}
          <section>
            <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest mb-3">
              Step 1 — Finish Position → Points
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Every Grand Prix awards points based on where you finish. Only human players are scored — bots fill the remaining 24 slots.
            </p>
            <div className="grid grid-cols-4 gap-1">
              {POINTS_TABLE.map(({ pos, pts }) => (
                <div
                  key={pos}
                  className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2"
                >
                  <span className="text-gray-400 text-xs">{pos}</span>
                  <span className={`font-bold text-sm tabular-nums ${pts > 0 ? "text-[#00d4ff]" : "text-gray-700"}`}>
                    {pts}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Step 2 — Bayesian formula */}
          <section>
            <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest mb-3">
              Step 2 — Bayesian Average
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Raw point totals favour players who have raced more. The Bayesian Average corrects for this by blending each player&apos;s personal score with the global average, weighted by how many GPs they&apos;ve played.
            </p>

            {/* Formula block */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-5 py-4 font-mono text-center">
              <p className="text-white text-lg">
                R = <span className="text-[#00d4ff]">(C × m) + Σ points</span>
                <span className="text-gray-600"> / </span>
                <span className="text-[#00d4ff]">(C + v)</span>
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {[
                { sym: "R", label: "Final rating shown on the leaderboard" },
                { sym: "C", label: "Average number of GPs played across all players (confidence anchor)" },
                { sym: "m", label: "Global average points per race entry" },
                { sym: "Σ points", label: "Sum of all points this player has ever earned" },
                { sym: "v", label: "Total GPs this player has played" },
              ].map(({ sym, label }) => (
                <div key={sym} className="flex gap-3">
                  <span className="text-[#00d4ff] font-mono text-sm w-20 shrink-0">{sym}</span>
                  <span className="text-gray-400 text-sm">{label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Why Bayesian */}
          <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              <span className="text-white font-semibold">Why does this matter?</span> A player who raced once and came 1st (15 pts) shouldn&apos;t outrank someone who consistently finishes 2nd across 20 GPs. The Bayesian formula pulls new players toward the group average until they&apos;ve played enough races to earn a truly representative score.
            </p>
          </section>

        </div>
      </motion.div>
    </motion.div>
  );
}
