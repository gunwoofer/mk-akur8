"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AvatarDisplay from "@/components/AvatarDisplay";
import type { RecapEntry } from "@/hooks/useLeaderboard";
import { formatSeasonRating, formatSeasonDelta, deltaThreshold } from "@/lib/format";

interface Props {
  entries: RecapEntry[];
  onDone: () => void;
}

function positionLabel(position: number, entries: RecapEntry[]) {
  const tied = entries.filter((e) => e.position === position).length > 1;
  if (tied) return `=${position}`;
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `P${position}`;
}

export default function GPRecapOverlay({ entries, onDone }: Props) {
  const doneRef = useRef(false);

  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const id = setTimeout(dismiss, entries.length * 600 + 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center cursor-pointer"
      onClick={dismiss}
    >
      <div className="absolute inset-0 bg-black/90" />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl mx-4 px-6 py-7 rounded-3xl border border-white/10 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #17171f 0%, #101016 70%)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
      >
        <div className="checkered h-2 absolute left-0 right-0 top-0 opacity-80" />
        <p className="font-racing mk-title text-3xl text-center leading-none mt-1">Grand Prix Results</p>
        <p className="text-[#9ca3af] text-xs tracking-[0.25em] uppercase text-center mt-2 mb-6">Season rating change</p>

        <div className="space-y-3">
          <AnimatePresence>
            {entries.map((entry, index) => {
              // Elo seasons start everyone at the same value, so a first GP still has a real delta.
              const isNew = entry.ratingBefore === null && entry.kind !== "elo";
              const delta = entry.ratingAfter - (entry.ratingBefore ?? entry.seasonStart);
              const threshold = deltaThreshold(entry.kind);
              const deltaColor =
                delta >= threshold ? "text-[#4ade80]" : delta <= -threshold ? "text-[#f87171]" : "text-gray-500";
              const barWidth = Math.max(4, ((25 - entry.position) / 24) * 100);

              return (
                <motion.div
                  key={entry.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.6, duration: 0.4, ease: "easeOut" }}
                  className="flex items-center"
                >
                  <span className="w-10 mr-3 text-center font-black text-sm text-gray-400 shrink-0">
                    {positionLabel(entry.position, entries)}
                  </span>
                  <AvatarDisplay
                    avatarUrl={entry.avatar_url}
                    characterAvatar={entry.character_avatar}
                    imgClassName="w-8 h-8 mr-3 shrink-0"
                    emojiClassName="text-2xl mr-3 leading-none shrink-0"
                  />
                  <span className="font-racing text-white text-sm uppercase w-28 mr-3 shrink-0 truncate">
                    {entry.name}
                  </span>
                  <div className="flex-1 mr-3 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ delay: index * 0.6 + 0.2, duration: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          entry.position <= 3
                            ? "linear-gradient(90deg, #ff9500, #ffd400)"
                            : "linear-gradient(90deg, #e60012, #ff5a36)",
                      }}
                    />
                  </div>
                  <span className="font-racing text-[#ffd400] text-sm tabular-nums w-12 text-right shrink-0">
                    {formatSeasonRating(entry.ratingAfter, entry.kind)}
                  </span>
                  <span className={`${isNew ? "text-[#ffd400]" : deltaColor} font-black text-sm tabular-nums w-16 text-right shrink-0`}>
                    {isNew ? "NEW" : Math.abs(delta) < threshold ? "±0" : formatSeasonDelta(delta, entry.kind)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <p className="text-[#4b5563] text-xs tracking-widest text-center mt-6">tap anywhere to dismiss</p>
      </motion.div>
    </motion.div>
  );
}
