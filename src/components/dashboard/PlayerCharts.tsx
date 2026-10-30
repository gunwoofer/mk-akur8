"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SeasonPoint, SeasonRecord } from "@/types";

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

export function SeasonLineChart({ series, height = 180 }: { series: SeasonPoint[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  if (series.length === 0) {
    return <p className="text-sm text-center py-10" style={{ color: AXIS_TEXT }}>No GP played this season yet.</p>;
  }

  const pad = { top: 14, right: 44, bottom: 24, left: 30 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const { top, ticks } = niceScale(Math.max(...series.map((p) => p.rating)));
  const x = (i: number) => pad.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;

  const line = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" ");
  const area = `${line} L${x(series.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
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
          aria-label={`Season rating after each of ${series.length} GPs, now ${series[last].rating.toFixed(2)}`}
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
            {series[last].rating.toFixed(2)}
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
          lines={[
            [h.rating.toFixed(2), `rating · GP ${hover + 1}`],
            [`P${h.position}`, `on ${shortDate(h.played_at)}`],
          ]}
        />
      )}
    </div>
  );
}

/* ── Seasonal ratings: final (or current) rating for each season played ── */

export function SeasonColumnChart({ seasons, height = 200 }: { seasons: SeasonRecord[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const shown = seasons.slice(-12);
  if (shown.length === 0) {
    return <p className="text-sm text-center py-10" style={{ color: AXIS_TEXT }}>No season played yet.</p>;
  }

  const pad = { top: 34, right: 8, bottom: 36, left: 30 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const { top, ticks } = niceScale(Math.max(...shown.map((s) => s.rating)));
  const band = innerW / shown.length;
  const barW = Math.min(24, band * 0.6);
  const cx = (i: number) => pad.left + band * (i + 0.5);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const showCapLabels = band >= 34;

  // Column: 4px rounded data-end, square at the baseline.
  const column = (i: number, v: number) => {
    const x0 = cx(i) - barW / 2;
    const y0 = y(v);
    const base = y(0);
    const r = Math.min(4, (base - y0) / 2, barW / 2);
    return `M${x0},${base} L${x0},${y0 + r} Q${x0},${y0} ${x0 + r},${y0} L${x0 + barW - r},${y0} Q${x0 + barW},${y0} ${x0 + barW},${y0 + r} L${x0 + barW},${base} Z`;
  };

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
          aria-label={`Season rating for ${shown.length} seasons`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>{t}</text>
            </g>
          ))}
          {shown.map((s, i) => (
            <g key={s.year_month}>
              <motion.path
                d={column(i, s.rating)}
                fill={SERIES}
                fillOpacity={s.is_current ? 0.45 : hover === i ? 1 : 0.9}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              />
              {s.won && (
                <text x={cx(i)} y={y(s.rating) - (showCapLabels ? 20 : 6)} textAnchor="middle" fontSize={14}>🏆</text>
              )}
              {showCapLabels && (
                <text x={cx(i)} y={y(s.rating) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={TEXT}>
                  {s.rating.toFixed(1)}
                </text>
              )}
              <text x={cx(i)} y={height - 20} textAnchor="middle" fontSize={11} fill={TEXT}>
                {s.month_name.slice(0, 3)}
              </text>
              <text x={cx(i)} y={height - 6} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
                {s.is_current ? "now" : `#${s.rank}`}
              </text>
            </g>
          ))}
          <rect x={0} y={0} width={width} height={height} fill="transparent" />
        </svg>
      )}
      {h && hover !== null && (
        <Tooltip
          x={cx(hover)}
          y={y(h.rating)}
          width={width}
          lines={[
            [h.rating.toFixed(2), `rating · ${h.month_name}`],
            [h.is_current ? `#${h.rank} so far` : h.won ? "🏆 Won" : `#${h.rank}`, `· ${h.gp} GPs`],
          ]}
        />
      )}
    </div>
  );
}
