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

const LAUNCH_INTERVAL_MS = 600;
const STOP_AFTER_MS = 5_000;

export function useFireworks(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  durationMs: number
) {
  const particlesRef = useRef<Particle[]>([]);
  const rafRef       = useRef<number>(0);
  const launchRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const explode = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Single burst per launch (was 1–3) — reduces particle count on old GPUs
    const x     = 0.08 * canvas.width  + Math.random() * 0.84 * canvas.width;
    const y     = 0.04 * canvas.height + Math.random() * 0.52 * canvas.height;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const count = 30 + Math.floor(Math.random() * 20); // was 65–120

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 6 + 1;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.008,
        color: Math.random() > 0.25 ? color : "#ffffff",
        size:  Math.random() * 3 + 1,
      });
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
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0.04);

      for (const p of particlesRef.current) {
        // No ctx.save/restore or shadowBlur — both are expensive on old hardware
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.13;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.alpha -= p.decay;
      }

      ctx.globalAlpha = 1;
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
