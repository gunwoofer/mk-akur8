"use client";

import { useCallback, useEffect, useRef } from "react";

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

const LAUNCH_INTERVAL_MS = 480;
const STOP_AFTER_MS = 5_000;

export function useFireworks(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  durationMs: number
) {
  const particlesRef = useRef<Particle[]>([]);
  const rafRef      = useRef<number>(0);
  const launchRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const explode = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bursts = Math.ceil(Math.random() * 3);
    for (let b = 0; b < bursts; b++) {
      const x     = 0.08 * canvas.width  + Math.random() * 0.84 * canvas.width;
      const y     = 0.04 * canvas.height + Math.random() * 0.52 * canvas.height;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
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
          color: Math.random() > 0.25 ? color : "#ffffff",
          size:  Math.random() * 3.5 + 1,
        });
      }
    }
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    explode();
    launchRef.current = setInterval(explode, LAUNCH_INTERVAL_MS);

    const animate = () => {
      // Semi-transparent fill creates the comet-trail fade effect
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0.03);

      for (const p of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha  = p.alpha;
        ctx.fillStyle    = p.color;
        ctx.shadowColor  = p.color;
        ctx.shadowBlur   = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.13;  // gravity
        p.vx *= 0.98;  // drag
        p.vy *= 0.98;
        p.alpha -= p.decay;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    const stopId = setTimeout(() => {
      if (launchRef.current) clearInterval(launchRef.current);
    }, Math.min(STOP_AFTER_MS, durationMs - 500));

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (launchRef.current) clearInterval(launchRef.current);
      clearTimeout(stopId);
    };
  }, [canvasRef, durationMs, explode]);
}
