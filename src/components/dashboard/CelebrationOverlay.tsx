"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";

interface Props {
  winner: { name: string; character_avatar: string };
  onDone: () => void;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  alpha: number; decay: number;
  color: string; size: number;
}

const COLORS = [
  "#00d4ff", "#FFD700", "#FF4500", "#00FF88",
  "#FF44FF", "#ffffff", "#FF8800", "#FFFF00", "#FF1493", "#7B61FF",
];

// {name} is replaced with the winner's name at render time
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
const LAUNCH_INTERVAL_MS = 480;
const STOP_LAUNCH_MS = 5000;

export default function CelebrationOverlay({ winner, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const launchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pick one random congrats line per render, substitute {name}
  const message = useMemo(() => {
    const template = CONGRATS_TEMPLATES[Math.floor(Math.random() * CONGRATS_TEMPLATES.length)];
    return template.replace(/{name}/g, winner.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const explode = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bursts = Math.ceil(Math.random() * 3);
    for (let b = 0; b < bursts; b++) {
      const x = 0.08 * canvas.width + Math.random() * 0.84 * canvas.width;
      const y = 0.04 * canvas.height + Math.random() * 0.52 * canvas.height;
      const baseColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      const count = 65 + Math.floor(Math.random() * 55);

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = Math.random() * 8.5 + 1.5;
        particlesRef.current.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          alpha: 1,
          decay: Math.random() * 0.013 + 0.007,
          color: Math.random() > 0.25 ? baseColor : "#ffffff",
          size: Math.random() * 3.5 + 1,
        });
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    explode();
    launchRef.current = setInterval(explode, LAUNCH_INTERVAL_MS);

    function animate() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0.03);

      for (const p of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.13;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.alpha -= p.decay;
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    const stopLaunch = setTimeout(() => {
      if (launchRef.current) clearInterval(launchRef.current);
    }, STOP_LAUNCH_MS);

    const autoClose = setTimeout(onDone, DISPLAY_MS);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (launchRef.current) clearInterval(launchRef.current);
      clearTimeout(stopLaunch);
      clearTimeout(autoClose);
    };
  }, [explode, onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
      onClick={onDone}
    >
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Fireworks canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Winner card */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 60 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 180, damping: 14 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col items-center gap-4 text-center px-16 py-10 rounded-3xl border border-yellow-400/40 bg-black/75 backdrop-blur-lg max-w-2xl w-full mx-4"
        style={{ boxShadow: "0 0 80px rgba(255,215,0,0.18), 0 0 160px rgba(0,212,255,0.08)" }}
      >
        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-yellow-400 font-black tracking-[0.3em] uppercase text-base"
        >
          🏆 Grand Prix Winner
        </motion.p>

        {/* Pulsing avatar */}
        <motion.div
          animate={{ scale: [1, 1.12, 1], rotate: [0, -5, 5, 0] }}
          transition={{ delay: 0.5, duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="text-[7rem] leading-none select-none"
        >
          {winner.character_avatar}
        </motion.div>

        {/* Player name */}
        <motion.p
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, type: "spring", stiffness: 200 }}
          className="font-black italic tracking-tight leading-none"
          style={{
            fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
            color: "#ffffff",
            textShadow: "0 0 24px rgba(0,212,255,0.9), 0 0 60px rgba(0,212,255,0.4)",
          }}
        >
          {winner.name.toUpperCase()}
        </motion.p>

        {/* Random congrats message */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="text-gray-300 text-lg leading-snug max-w-md"
        >
          {message}
        </motion.p>

        {/* Progress bar */}
        <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden mt-1">
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
