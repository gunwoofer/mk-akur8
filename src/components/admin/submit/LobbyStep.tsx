"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/types";

interface Props {
  players: Player[];
  loading: boolean;
  error: string | null;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
}

export default function LobbyStep({ players, loading, error, selected, onToggle, onNext }: Props) {
  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-5 h-5 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
      {error}
    </div>
  );

  if (players.length === 0) return (
    <p className="text-gray-600 text-sm text-center py-12">
      No players yet. Add some in the Players tab.
    </p>
  );

  return (
    <>
      <div className="space-y-1.5">
        {players.map((p) => {
          const on = selected.has(p.id);
          return (
            <motion.button
              key={p.id}
              onClick={() => onToggle(p.id)}
              whileTap={{ scale: 0.985 }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-colors ${
                on ? "border-[#00d4ff]/30 bg-[#00d4ff]/8" : "border-[#1e1e1e] bg-[#141414] active:bg-[#181818]"
              }`}
            >
              <span className="text-2xl shrink-0">{p.character_avatar}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                <p className="text-gray-600 text-xs">{p.gp_played} GPs · {p.rating.toFixed(2)} pts</p>
              </div>
              <motion.div
                animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-5 h-5 rounded-full bg-[#00d4ff] flex items-center justify-center shrink-0"
              >
                <span className="text-black text-[10px] font-black">✓</span>
              </motion.div>
            </motion.button>
          );
        })}
      </div>

      <div className="sticky bottom-0 bg-[#0a0a0a] pt-2 pb-1">
        <motion.button
          onClick={onNext}
          disabled={selected.size === 0}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3.5 bg-[#00d4ff] text-black font-bold text-sm rounded-2xl disabled:opacity-30 transition-opacity"
        >
          {selected.size === 0
            ? "Select at least one racer"
            : `Continue with ${selected.size} racer${selected.size > 1 ? "s" : ""} →`}
        </motion.button>
      </div>
    </>
  );
}
