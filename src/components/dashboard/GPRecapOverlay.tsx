"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AvatarDisplay from "@/components/AvatarDisplay";
import type { RecapEntry } from "@/hooks/useLeaderboard";

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
        className="relative w-full max-w-xl mx-4 px-8 py-8 rounded-3xl border border-[#00d4ff]/20 bg-black/90"
        style={{ boxShadow: "0 0 60px rgba(0,212,255,0.08)" }}
      >
        <p className="text-[#00d4ff] font-black tracking-[0.3em] uppercase text-sm mb-6 text-center">
          Grand Prix Results
        </p>

        <div className="space-y-3">
          <AnimatePresence>
            {entries.map((entry, index) => {
              const delta = entry.ratingAfter - entry.ratingBefore;
              const absDelta = Math.abs(delta);
              const deltaColor =
                delta > 0.005 ? "text-[#4ade80]" : delta < -0.005 ? "text-[#f87171]" : "text-gray-500";
              const deltaSign = delta > 0.005 ? "+" : delta < -0.005 ? "−" : "±";
              const barWidth = Math.max(4, ((25 - entry.position) / 24) * 100);

              return (
                <motion.div
                  key={entry.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.6, duration: 0.4, ease: "easeOut" }}
                  className="flex items-center gap-3"
                >
                  <span className="w-10 text-center font-black text-sm text-gray-400 shrink-0">
                    {positionLabel(entry.position, entries)}
                  </span>
                  <AvatarDisplay
                    avatarUrl={entry.avatar_url}
                    characterAvatar={entry.character_avatar}
                    imgClassName="w-8 h-8 shrink-0"
                    emojiClassName="text-2xl leading-none shrink-0"
                  />
                  <span className="text-white font-bold text-sm w-28 shrink-0 truncate">
                    {entry.name}
                  </span>
                  <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ delay: index * 0.6 + 0.2, duration: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          entry.position <= 3
                            ? "linear-gradient(90deg, #fac800, #ffdd57)"
                            : "linear-gradient(90deg, #00d4ff, #0099bb)",
                      }}
                    />
                  </div>
                  <span className={`${deltaColor} font-black text-sm tabular-nums w-16 text-right shrink-0`}>
                    {deltaSign}{absDelta.toFixed(2)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <p className="text-gray-700 text-xs tracking-widest text-center mt-6">tap anywhere to dismiss</p>
      </motion.div>
    </motion.div>
  );
}
