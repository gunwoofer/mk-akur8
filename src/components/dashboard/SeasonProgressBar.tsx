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
        <span className="font-racing text-outline text-white text-base uppercase tracking-wider">
          {info.month_name}
          <span className="text-[#ffd400] ml-2">— Season {info.season_number}</span>
        </span>
        {info.has_games ? (
          <span className="text-[#e5e7eb] text-xs tabular-nums text-outline">
            {info.days_left === 0 ? "Last day" : `${info.days_left} day${info.days_left !== 1 ? "s" : ""} left`}
          </span>
        ) : (
          <span className="text-[#cbd5e1] text-xs italic text-outline">Season starts with your next GP</span>
        )}
      </div>
      <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden border border-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #e60012, #ff7a00 60%, #ffd400)" }}
        />
      </div>
    </div>
  );
}
