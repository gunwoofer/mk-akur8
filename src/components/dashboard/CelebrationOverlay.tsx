"use client";

import { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { useFireworks } from "@/hooks/useFireworks";

interface Props {
  winner: { name: string; character_avatar: string };
  onDone: () => void;
}

const CONGRATS_TEMPLATES = [
  "Shell yeah, {name}! Nobody could touch you! 🐢",
  "{name} just speed-ran everyone's dignity! 💀",
  "Bow down to your office champion — {name}! 👑",
  "Call HR, {name} is being dangerously good again! 📞",
  "Blue shell? Didn't even faze {name}! 💙",
  "{name} left the whole field eating rubber! 🔥",
  "Bullet Bill energy: {name} obliterated the competition! 💥",
  "No rubber banding could save anyone from {name}! 😤",
  "Mario himself called — he wants tips from {name}! 🍄",
  "Rainbow Road? More like Rainbow GOAT — that's {name}! 🌈",
  "{name} cooked everyone and didn't even use a single item! 👨‍🍳",
  "P1. {name}. Obviously. No further questions. 😎",
  "Someone nerf {name}, this is getting embarrassing! 🚨",
  "This is {name}'s office now. We just race in it. 🏠",
  "The legend of {name} grows stronger with every GP! ✨",
  "GG everyone — {name} lapped the field twice! 🏎️",
  "{name}: winner, champion, office menace since day one! 🏆",
  "Lap completed. Rivals humiliated. {name} doesn't miss! 🎯",
  "Did {name} even break a sweat? Apparently not. 🥱",
  "Insert coin to race {name}... actually, save your money! 🎰",
  "{name} pulled off the greatest heist in kart history! 🦊",
  "The road to victory was paved by {name}'s tyres! 🛣️",
  "Absolute scenes! {name} wins it with pure class! 🎬",
  "{name}: 1. Everyone else: respectfully, 0. 💯",
  "Unstoppable force detected. Codename: {name}! ⚡",
  "They came, they raced, {name} conquered. Classic. ⚔️",
  "POV: you just got lapped by {name} again! 😵",
  "{name} activated cheat codes and forgot to turn them off! 🕹️",
  "The kart has spoken — {name} reigns supreme! 🏁",
  "Pure, uncut, undefeatable skill. That's just {name}. 🧬",
];

const DISPLAY_MS = 7000;

export default function CelebrationOverlay({ winner, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useFireworks(canvasRef, DISPLAY_MS);

  useEffect(() => {
    const id = setTimeout(onDone, DISPLAY_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const message = useMemo(() => {
    const template = CONGRATS_TEMPLATES[Math.floor(Math.random() * CONGRATS_TEMPLATES.length)];
    return template.replace(/{name}/g, winner.name);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      // inset-0 expanded to top-0 right-0 bottom-0 left-0 by PostCSS for iOS 12
      className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
      onClick={onDone}
    >
      {/* No backdrop-blur — compositing cost is too high on older hardware */}
      <div className="absolute inset-0 bg-black/85" />
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative text-center px-12 py-10 rounded-3xl border border-yellow-400/40 bg-black/90 max-w-2xl w-full mx-4"
        style={{ boxShadow: "0 0 60px rgba(255,215,0,0.15)" }}
      >
        <p className="text-yellow-400 font-black tracking-[0.3em] uppercase text-base mb-6">
          🏆 Grand Prix Winner
        </p>

        {/* Static emoji — infinite animations are very expensive on A7 chip */}
        <div className="text-[7rem] leading-none select-none mb-6">
          {winner.character_avatar}
        </div>

        <p
          className="font-black italic tracking-tight leading-none mb-6"
          style={{
            fontSize: "4.5rem",
            color: "#ffffff",
            textShadow: "0 0 24px rgba(0,212,255,0.9), 0 0 60px rgba(0,212,255,0.4)",
          }}
        >
          {winner.name.toUpperCase()}
        </p>

        <p className="text-gray-300 text-lg leading-snug max-w-md mx-auto mb-6">
          {message}
        </p>

        <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden mb-4">
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: DISPLAY_MS / 1000, ease: "linear" }}
            className="h-full bg-yellow-400/50 rounded-full"
          />
        </div>

        <p className="text-gray-700 text-xs tracking-widest">tap anywhere to dismiss</p>
      </motion.div>
    </motion.div>
  );
}
