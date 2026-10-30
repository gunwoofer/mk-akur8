"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AvatarDisplay from "@/components/AvatarDisplay";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Overtake, OvertakePlayer } from "@/hooks/useLeaderboard";

const SHOW_MS = 7500;

function Racer({ player, size, ring, dim }: { player: OvertakePlayer; size: number; ring: string; dim?: boolean }) {
  return (
    <div className="flex flex-col items-center" style={{ opacity: dim ? 0.55 : 1 }}>
      <div
        className="rounded-full overflow-hidden flex items-center justify-center bg-black/70"
        style={{ width: size, height: size, border: `4px solid ${ring}`, boxShadow: dim ? "none" : `0 0 24px ${ring}88` }}
      >
        <AvatarDisplay
          avatarUrl={player.avatar_url}
          characterAvatar={player.character_avatar}
          imgClassName="w-full h-full"
          emojiClassName={size > 80 ? "text-5xl" : "text-4xl"}
        />
      </div>
      <p className="font-racing text-outline text-white uppercase text-sm mt-2 whitespace-nowrap">{player.name}</p>
    </div>
  );
}

export default function OvertakeOverlay({ overtakes, onDone }: { overtakes: Overtake[]; onDone: () => void }) {
  const mobile = useIsMobile();
  const [index, setIndex] = useState(0);
  const current = overtakes[index];

  const next = () => {
    if (index + 1 < overtakes.length) setIndex(index + 1);
    else onDone();
  };

  useEffect(() => {
    const id = setTimeout(next, SHOW_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!current) return null;

  const size = mobile ? 72 : 104;
  const spread = mobile ? 70 : 120;   // final distance of each racer from the centre
  const half = size / 2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer overflow-hidden"
      onClick={next}
    >
      <div className="absolute inset-0 bg-black/90" />

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-2xl mx-4 flex flex-col items-center text-center"
        >
          <motion.p
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className={`font-racing mk-title leading-none ${mobile ? "text-4xl" : "text-6xl"}`}
          >
            Overtake!
          </motion.p>

          {/* The pass: the overtaker dashes in from behind while the overtaken drops back */}
          <div className="relative w-full mt-8 mb-6" style={{ height: size + 34 }}>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{ left: "50%", top: half - 6 + i * 6, height: 2, width: mobile ? 90 : 160, background: "linear-gradient(90deg, transparent, #ffd400)" }}
                initial={{ x: -spread * 3, opacity: 0 }}
                animate={{ x: [-spread * 3, spread * 0.2], opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.8, delay: 0.25 + i * 0.05, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="absolute"
              style={{ left: "50%", top: 0, marginLeft: -half }}
              initial={{ x: spread * 0.5 }}
              animate={{ x: -spread }}
              transition={{ duration: 0.9, delay: 0.25, ease: "easeInOut" }}
            >
              <Racer player={current.passed} size={size} ring="#6b7280" dim />
            </motion.div>
            <motion.div
              className="absolute"
              style={{ left: "50%", top: 0, marginLeft: -half }}
              initial={{ x: -spread * 3.2, scale: 0.9 }}
              animate={{ x: spread, scale: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.25 }}
            >
              <Racer player={current.passer} size={size} ring="#ffd400" />
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.4 }}
            className={`font-racing text-outline text-white ${mobile ? "text-xl" : "text-3xl"} leading-snug`}
          >
            {current.line}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.4 }}
            className="text-[#cbd5e1] text-sm uppercase tracking-widest mt-3"
          >
            {current.passer.name} is now <span className="text-[#ffd400] font-bold">P{current.newRank}</span> this season
          </motion.p>

          {overtakes.length > 1 && (
            <div className="flex mt-6">
              {overtakes.map((_, i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full mx-1"
                  style={{ background: i === index ? "#ffd400" : "rgba(255,255,255,0.25)" }}
                />
              ))}
            </div>
          )}
          <p className="text-[#4b5563] text-xs tracking-widest mt-4">tap to skip</p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
