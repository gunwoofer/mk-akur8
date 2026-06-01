"use client";

import { motion } from "framer-motion";
import { POINTS_TABLE } from "@/lib/points";

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
            <p className="text-gray-500 text-sm mt-0.5">Bayesian rating with experience weight</p>
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
              Every Grand Prix awards points based on where you finish. Only human players are scored — bots fill the remaining slots silently.
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

          {/* Step 2 — Rating formula */}
          <section>
            <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest mb-3">
              Step 2 — Experience-Weighted Rating
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Raw totals favour whoever races the most. Instead, your rating is your total points divided by your games played — but with <span className="text-white font-medium">20 phantom zero-point races</span> added to the denominator. New players start near zero and must earn their rank through consistent results.
            </p>

            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-5 py-4 font-mono text-center">
              <p className="text-white text-lg">
                R = <span className="text-[#00d4ff]">Σ points</span>
                <span className="text-gray-600"> / </span>
                <span className="text-[#00d4ff]">(20 + GPs played)</span>
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                { sym: "R", label: "Final rating — ranges from 0 to just below 15" },
                { sym: "Σ points", label: "Sum of all GP points this player has ever scored" },
                { sym: "20", label: "Fixed prior: 20 phantom races at zero points, diluting early results" },
                { sym: "GPs played", label: "Total races entered; as this grows the prior loses influence" },
              ].map(({ sym, label }) => (
                <div key={sym} className="flex gap-3">
                  <span className="text-[#00d4ff] font-mono text-sm w-24 shrink-0">{sym}</span>
                  <span className="text-gray-400 text-sm">{label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Examples */}
          <section>
            <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest mb-3">
              In Practice
            </p>
            <div className="space-y-2">
              {[
                { label: "1 GP, P1 win (15 pts)",           rating: "0.71", note: "One great race counts little" },
                { label: "10 GPs, always P3 (100 pts)",     rating: "3.33", note: "Consistency starts to show" },
                { label: "20 GPs, always P1 (300 pts)",     rating: "7.50", note: "Dominance rewarded over time" },
                { label: "Max possible — P1 every race",    rating: "→ 15", note: "Asymptotic ceiling, never reached" },
              ].map(({ label, rating, note }) => (
                <div key={label} className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{label}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{note}</p>
                  </div>
                  <span className="text-[#00d4ff] font-black text-lg tabular-nums shrink-0">{rating}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Summary callout */}
          <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              <span className="text-white font-semibold">The key insight:</span> winning one race takes you to 0.71. Winning twenty takes you to 7.50. You cannot shortcut the leaderboard — sustained front-running across many GPs is the only path to the top.
            </p>
          </section>

        </div>
      </motion.div>
    </motion.div>
  );
}
