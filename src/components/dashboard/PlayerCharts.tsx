"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SeasonKind, SeasonPoint, SeasonRecord } from "@/types";
import { formatSeasonRating } from "@/lib/format";

// Chart tokens on the modal's dark surface. Single series → no legend; the card title names it.
const SURFACE = "#101016";
const SERIES = "#ffd400";
const GRID = "#2a2a33";
const AXIS_TEXT = "#9ca3af";
const TEXT = "#f3f4f6";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// ResizeObserver needs Safari 13.1 — the TV's iOS 12 iPad doesn't have it.
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const update = () => setWidth(ref.current?.clientWidth ?? 0);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return [ref, width] as const;
}

// Elo values sit far from zero: frame the range actually reached, on round 25/50/100 steps.
function eloScale(min: number, max: number): { bottom: number; top: number; ticks: number[] } {
  const span = Math.max(40, max - min);
  const step = span <= 80 ? 20 : span <= 200 ? 50 : 100;
  const bottom = Math.floor((min - step / 2) / step) * step;
  const top = Math.ceil((max + step / 2) / step) * step;
  const ticks: number[] = [];
  for (let t = bottom; t <= top; t += step) ticks.push(t);
  return { bottom, top, ticks };
}

function niceScale(max: number): { top: number; ticks: number[] } {
  const raw = Math.max(1, Math.ceil(max));
  const step = raw <= 4 ? 1 : raw <= 10 ? 2 : raw <= 25 ? 5 : 10;
  const top = Math.ceil(raw / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

function Tooltip({ x, y, width, lines }: { x: number; y: number; width: number; lines: [string, string][] }) {
  const boxW = 150;
  const left = Math.min(Math.max(x - boxW / 2, 0), Math.max(0, width - boxW));
  return (
    <div
      className="absolute pointer-events-none rounded-lg border px-3 py-2"
      style={{ left, top: Math.max(0, y - 74), width: boxW, background: "#0b0b10", borderColor: GRID, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
    >
      {lines.map(([value, label], i) => (
        <p key={i} className="text-xs leading-snug">
          <span className="font-semibold" style={{ color: TEXT }}>{value}</span>
          <span style={{ color: AXIS_TEXT }}> {label}</span>
        </p>
      ))}
    </div>
  );
}

function pointerX(e: React.MouseEvent | React.TouchEvent, el: Element) {
  const rect = el.getBoundingClientRect();
  const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
  return clientX - rect.left;
}

/* ── Season progression: season rating after each GP this month ─────────── */

export function SeasonLineChart({
  series: played, kind, start, height = 180,
}: { series: SeasonPoint[]; kind: SeasonKind; start: number; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  // Elo seasons begin at the starting value: draw it as point 0 so the climb (or fall) shows.
  const series: (SeasonPoint & { start?: boolean })[] =
    kind === "elo" && played.length > 0
      ? [{ played_at: played[0].played_at, rating: start, position: 0, start: true }, ...played]
      : played;
  const fmt = (v: number) => formatSeasonRating(v, kind);

  if (series.length === 0) {
    return <p className="text-sm text-center py-10" style={{ color: AXIS_TEXT }}>No GP played this season yet.</p>;
  }

  const pad = { top: 14, right: 44, bottom: 24, left: kind === "elo" ? 40 : 30 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const values = series.map((p) => p.rating);
  const { bottom, top, ticks } = kind === "elo"
    ? eloScale(Math.min(...values), Math.max(...values))
    : { bottom: 0, ...niceScale(Math.max(...values)) };
  const x = (i: number) => pad.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - bottom) / (top - bottom)) * innerH;

  const line = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" ");
  const area = `${line} L${x(series.length - 1).toFixed(1)},${y(bottom)} L${x(0).toFixed(1)},${y(bottom)} Z`;
  const last = series.length - 1;

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (innerW <= 0) return;
    const px = pointerX(e, e.currentTarget);
    const i = series.length === 1 ? 0 : Math.round(((px - pad.left) / innerW) * (series.length - 1));
    setHover(Math.min(last, Math.max(0, i)));
  };

  const h = hover !== null ? series[hover] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          onMouseMove={onMove}
          onTouchStart={onMove}
          onTouchMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`Season rating after each of ${played.length} GPs, now ${fmt(series[last].rating)}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>{t}</text>
            </g>
          ))}
          <text x={pad.left} y={height - 6} fontSize={11} fill={AXIS_TEXT}>{shortDate(series[0].played_at)}</text>
          {series.length > 1 && (
            <text x={x(last)} y={height - 6} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>{shortDate(series[last].played_at)}</text>
          )}

          {series.length > 1 && <path d={area} fill={SERIES} fillOpacity={0.1} />}
          {series.length > 1 && (
            <motion.path
              d={line}
              fill="none"
              stroke={SERIES}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          )}

          {h && hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke={AXIS_TEXT} strokeWidth={1} />
          )}

          <circle cx={x(last)} cy={y(series[last].rating)} r={4} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
          <text x={x(last) + 8} y={y(series[last].rating) + 4} fontSize={12} fontWeight={600} fill={TEXT}>
            {fmt(series[last].rating)}
          </text>

          {h && hover !== null && hover !== last && (
            <circle cx={x(hover)} cy={y(h.rating)} r={4} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
          )}
          <rect x={0} y={0} width={width} height={height} fill="transparent" />
        </svg>
      )}
      {h && hover !== null && (
        <Tooltip
          x={x(hover)}
          y={y(h.rating)}
          width={width}
          lines={h.start
            ? [[fmt(h.rating), "season start"]]
            : [
                [fmt(h.rating), `rating · GP ${series[0].start ? hover : hover + 1}`],
                [`P${h.position}`, `on ${shortDate(h.played_at)}`],
              ]}
        />
      )}
    </div>
  );
}

/* ── Season score at the end of each month ───────────────────────────────
   Each Elo season restarts at the same value, so month-end scores compare
   directly. Older average-based seasons use another scale: only seasons of the
   latest season's kind are drawn. */

export function SeasonEndChart({ seasons, height = 200 }: { seasons: SeasonRecord[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const latestKind = seasons[seasons.length - 1]?.kind;
  const shown = seasons.filter((s) => s.kind === latestKind).slice(-12);
  if (shown.length === 0) {
    return <p className="text-sm text-center py-10" style={{ color: AXIS_TEXT }}>No season played yet.</p>;
  }

  const elo = latestKind === "elo";
  const fmt = (s: SeasonRecord) => formatSeasonRating(s.rating, s.kind);
  const values = shown.map((s) => s.rating);
  const { bottom, top, ticks } = elo
    ? eloScale(Math.min(...values), Math.max(...values))
    : { bottom: 0, ...niceScale(Math.max(...values)) };

  const pad = { top: 26, right: 44, bottom: 24, left: elo ? 40 : 30 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const band = innerW / shown.length;
  const cx = (i: number) => pad.left + band * (i + 0.5);
  const y = (v: number) => pad.top + innerH - ((v - bottom) / (top - bottom)) * innerH;
  const line = shown.map((s, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(s.rating).toFixed(1)}`).join(" ");
  const last = shown.length - 1;

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (band <= 0) return;
    const i = Math.floor((pointerX(e, e.currentTarget) - pad.left) / band);
    setHover(i >= 0 && i < shown.length ? i : null);
  };

  const h = hover !== null ? shown[hover] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          onMouseMove={onMove}
          onTouchStart={onMove}
          onTouchMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`Season score at the end of ${shown.length} months, latest ${fmt(shown[last])}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>{t}</text>
            </g>
          ))}
          {shown.length > 1 && (
            <motion.path
              d={line}
              fill="none"
              stroke={SERIES}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          )}
          {hover !== null && (
            <line x1={cx(hover)} x2={cx(hover)} y1={pad.top} y2={pad.top + innerH} stroke={AXIS_TEXT} strokeWidth={1} />
          )}
          {shown.map((s, i) => (
            <g key={s.year_month}>
              <circle
                cx={cx(i)}
                cy={y(s.rating)}
                r={s.won ? 6 : 4}
                fill={s.is_current ? SURFACE : SERIES}
                stroke={s.is_current ? SERIES : SURFACE}
                strokeWidth={2}
              />
              {s.won && <text x={cx(i)} y={y(s.rating) - 10} textAnchor="middle" fontSize={13}>🏆</text>}
              <text x={cx(i)} y={height - 6} textAnchor="middle" fontSize={11} fill={TEXT}>
                {s.is_current ? "Now" : s.month_name.slice(0, 3)}
              </text>
            </g>
          ))}
          <text x={cx(last) + 10} y={y(shown[last].rating) + 4} fontSize={12} fontWeight={600} fill={TEXT}>
            {fmt(shown[last])}
          </text>
          <rect x={0} y={0} width={width} height={height} fill="transparent" />
        </svg>
      )}
      {h && hover !== null && (
        <Tooltip
          x={cx(hover)}
          y={y(h.rating)}
          width={width}
          lines={[
            [fmt(h), `${h.kind === "elo" ? "season Elo" : "season rating"} · ${h.is_current ? `${h.month_name} so far` : `end of ${h.month_name}`}`],
            [`#${h.rank} of ${h.players}`, `that season${h.won ? " 🏆" : ""} · ${h.gp} GPs`],
          ]}
        />
      )}
    </div>
  );
}
