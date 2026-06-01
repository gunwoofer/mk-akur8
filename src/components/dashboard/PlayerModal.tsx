"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { PlayerStats } from "@/types";

const POSITION_COLORS: Record<number, string> = {
  1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32",
};

function posColor(pos: number) {
  return POSITION_COLORS[pos] ?? (pos <= 10 ? "#00d4ff" : "#4a4a4a");
}

interface Props {
  stats: PlayerStats | null;
  playerName: string;
  onClose: () => void;
}

export default function PlayerModal({ stats, playerName, onClose }: Props) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(onClose, 15000);
  };

  useEffect(() => {
    resetTimeout();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const player = stats?.player;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      onClick={onClose}
      onPointerMove={resetTimeout}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85" />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center p-6 border-b border-[#2a2a2a]">
          {player && (
            <span className="text-5xl mr-4">{player.character_avatar}</span>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-black text-3xl italic tracking-tight truncate">
              {player?.name.toUpperCase() ?? playerName.toUpperCase()}
            </h2>
            {player && (
              <p className="text-[#00d4ff] text-sm font-semibold">
                Rating: {player.rating.toFixed(4)} · {player.gp_played} GPs played
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white text-2xl transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {!stats ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-px bg-[#2a2a2a] border-b border-[#2a2a2a]">
              {[
                { label: "GPs Played", value: stats.player.gp_played },
                { label: "Podiums", value: stats.podiums },
                { label: "Worst Finish", value: stats.worst_finish ? `P${stats.worst_finish}` : "—" },
                { label: "Avg. Placement", value: stats.avg_placement ? `P${stats.avg_placement}` : "—" },
              ].map((s) => (
                <div key={s.label} className="bg-[#141414] px-5 py-4 text-center">
                  <p className="text-white font-black text-2xl">{s.value}</p>
                  <p className="text-gray-600 text-xs uppercase tracking-widest mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Form guide */}
            <div className="p-6">
              <p className="text-gray-600 text-xs uppercase tracking-widest mb-4">
                Form Guide — Last {Math.min(10, stats.recent_results.length)} GPs
              </p>

              {stats.recent_results.length === 0 ? (
                <p className="text-gray-700 text-sm text-center py-4">No history yet.</p>
              ) : (
                <div className="space-y-2">
                  {stats.recent_results.map((r, i) => (
                    <div
                      key={r.match_id}
                      className="flex items-center"
                    >
                      {/* Position badge */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm shrink-0 mr-3"
                        style={{
                          backgroundColor: `${posColor(r.position)}22`,
                          color: posColor(r.position),
                          border: `1px solid ${posColor(r.position)}44`,
                        }}
                      >
                        P{r.position}
                      </div>

                      {/* Timeline bar */}
                      <div className="flex-1 relative h-6 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(4, ((25 - r.position) / 24) * 100)}%` }}
                          transition={{ delay: i * 0.05, duration: 0.5, ease: "easeOut" }}
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ backgroundColor: posColor(r.position) + "88" }}
                        />
                      </div>

                      {/* Date */}
                      <p className="text-gray-700 text-xs tabular-nums shrink-0 w-20 text-right">
                        {r.played_at
                          ? new Date(r.played_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-close hint */}
            <div className="px-6 pb-4 text-center">
              <p className="text-gray-800 text-xs">Auto-closes in 15 s · click anywhere to dismiss</p>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
