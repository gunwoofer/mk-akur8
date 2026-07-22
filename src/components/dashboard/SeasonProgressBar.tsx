"use client";

import { motion } from "framer-motion";
import type { SeasonInfo } from "@/types";

interface Props {
  info: SeasonInfo | null;
}

export default function SeasonProgressBar({ info }: Props) {
  if (!info) return null;

  const progress = info.has_games
    ? Math.min(1, (info.days_total - info.days_left) / info.days_total)
    : 0;

  return (
    <div className="mb-4 shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white font-black text-sm uppercase tracking-widest">
          {info.month_name}
          <span className="text-[#00d4ff] ml-2">— Season {info.season_number}</span>
        </span>
        {info.has_games ? (
          <span className="text-[#6b7280] text-xs tabular-nums">
            {info.days_left === 0 ? "Last day" : `${info.days_left} day${info.days_left !== 1 ? "s" : ""} left`}
          </span>
        ) : (
          <span className="text-[#4b5563] text-xs italic">Season starts with your next GP</span>
        )}
      </div>
      <div className="h-1.5 w-full bg-[#1a1a1a] rounded-full overflow-hidden border border-[#2a2a2a]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #00d4ff, #0099bb)" }}
        />
      </div>
    </div>
  );
}
