"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlayerStats, SeasonKind, StatBlock } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SeasonLineChart, SeasonEndRatingChart } from "./PlayerCharts";
import { formatSeasonRating, formatSeasonDelta, deltaThreshold } from "@/lib/format";

type View = "season" | "global";

const MK_RED = "#e60012";
const MK_YELLOW = "#ffd400";
const RANK_RING: Record<number, string> = { 1: "#ffd400", 2: "#d9dde3", 3: "#e8893c" };

const FINISH_CHIP: Record<number, { bg: string; fg: string }> = {
  1: { bg: "linear-gradient(180deg, #fff3a0, #ffd400 45%, #d98a00)", fg: "#1a1206" },
  2: { bg: "linear-gradient(180deg, #ffffff, #cfd4da 45%, #8d949e)", fg: "#1a1206" },
  3: { bg: "linear-gradient(180deg, #ffd2a6, #e8893c 45%, #9a4a12)", fg: "#1a1206" },
};

interface Props {
  stats: PlayerStats | null;
  playerName: string;
  streak?: number;
  initialView: View;
  onClose: () => void;
}

export default function PlayerModal({ stats, playerName, streak, initialView, onClose }: Props) {
  const mobile = useIsMobile();
  const hasSeasonGames = (stats?.current_season.stats.gp ?? 0) > 0;
  const [view, setView] = useState<View>(initialView);
  const effectiveView: View = stats && !hasSeasonGames ? "global" : view;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The TV dashboard is unattended: close by itself after 15 s without interaction.
  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(onClose, 15000);
  };

  useEffect(() => {
    resetTimeout();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const player = stats?.player;
  const block: StatBlock | null = stats ? (effectiveView === "season" ? stats.current_season.stats : stats.global) : null;
  const ring = (block?.rank && RANK_RING[block.rank]) || MK_RED;
  // Global keeps the 0–15 average format; the season uses its own kind (Elo from Nov 2026).
  const kind: SeasonKind = !stats
    ? "average"
    : effectiveView === "season" ? stats.current_season.kind : stats.player.rating_kind ?? "average";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`fixed inset-0 z-50 flex items-center justify-center ${mobile ? "p-3" : "p-8"}`}
      onClick={onClose}
      onMouseMove={resetTimeout}
      onTouchStart={resetTimeout}
    >
      <div className="absolute inset-0 bg-black/85" />

      <motion.div
        initial={{ scale: 0.94, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl flex flex-col overflow-hidden rounded-2xl border border-white/10 max-h-[90vh]"
        style={{ background: "linear-gradient(180deg, #17171f 0%, #101016 60%)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
      >
        <div className="checkered h-2 w-full shrink-0 opacity-80" />
        <div className="h-1 w-full shrink-0" style={{ background: MK_RED }} />

        {/* Header */}
        <div className={`flex items-center shrink-0 ${mobile ? "px-4 pt-4 pb-3" : "px-7 pt-6 pb-4"}`}>
          <div
            className="rounded-full overflow-hidden flex items-center justify-center bg-black/60 shrink-0"
            style={{ width: mobile ? 60 : 84, height: mobile ? 60 : 84, border: `4px solid ${ring}`, boxShadow: `0 0 22px ${ring}55` }}
          >
            {player && (
              <AvatarDisplay
                avatarUrl={player.avatar_url}
                characterAvatar={player.character_avatar}
                imgClassName="w-full h-full"
                emojiClassName={mobile ? "text-3xl" : "text-5xl"}
              />
            )}
          </div>
          <div className={`flex-1 min-w-0 ${mobile ? "ml-3" : "ml-5"}`}>
            <h2 className={`font-racing text-outline text-white uppercase truncate leading-none ${mobile ? "text-2xl" : "text-4xl"}`}>
              {player?.name ?? playerName}
            </h2>
            <div className="flex flex-wrap items-center mt-2">
              {stats && stats.season_wins > 0 && (
                <Badge>🏆 {stats.season_wins} season{stats.season_wins !== 1 ? "s" : ""} won</Badge>
              )}
              {streak !== undefined && <Badge>🔥 {streak} win streak</Badge>}
              {stats && <Badge>{stats.global.gp} GPs</Badge>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 ml-3 w-9 h-9 rounded-full flex items-center justify-center text-[#9ca3af] border border-white/10 bg-black/40"
          >
            ✕
          </button>
        </div>

        {!stats || !block ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#ffd400] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className={`overflow-y-auto flex-1 min-h-0 ${mobile ? "px-4 pb-4" : "px-7 pb-6"}`}>
            {/* Season / Global switch */}
            <div className="flex bg-black/50 border border-white/10 rounded-xl p-1 mb-5 self-start w-max">
              {(["season", "global"] as const).map((v) => {
                const disabled = v === "season" && !hasSeasonGames;
                const active = effectiveView === v;
                return (
                  <button
                    key={v}
                    disabled={disabled}
                    onClick={() => { setView(v); resetTimeout(); }}
                    className={`relative font-racing px-5 py-1.5 rounded-lg text-sm uppercase ${v === "global" ? "ml-1" : ""} ${
                      active ? "text-white" : disabled ? "text-[#4b5563]" : "text-[#9ca3af]"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="player-view-pill"
                        className="absolute rounded-lg"
                        style={{ top: 0, right: 0, bottom: 0, left: 0, background: MK_RED }}
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative">{v === "season" ? stats.current_season.month_name : "Global"}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={effectiveView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {/* Hero: rating + rank */}
                <div className="flex items-end justify-between mb-5">
                  <div>
                    <p className="text-[#9ca3af] text-xs uppercase tracking-widest mb-1">
                      {effectiveView === "season"
                        ? `${stats.current_season.month_name} ${kind === "elo" ? "Elo" : "rating"}`
                        : kind === "elo" ? "Global Elo" : "Global rating"}
                    </p>
                    <div className="flex items-end">
                      <p className={`font-racing text-outline tabular-nums leading-none ${mobile ? "text-5xl" : "text-6xl"}`} style={{ color: MK_YELLOW }}>
                        {formatSeasonRating(block.rating, kind)}
                      </p>
                      <Delta value={block.rating_delta} kind={kind} />
                    </div>
                  </div>
                  {block.rank !== null && (
                    <div className="text-right">
                      <p className="text-[#9ca3af] text-xs uppercase tracking-widest mb-1">
                        {effectiveView === "season" ? "This season" : "Overall"}
                      </p>
                      <p className={`font-racing text-outline text-white leading-none ${mobile ? "text-4xl" : "text-5xl"}`}>
                        #{block.rank}
                        <span className="text-[#9ca3af] text-lg ml-1">/ {block.ranked_players}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Stat tiles */}
                <div className={`grid gap-2 mb-5 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
                  <Tile label="GPs" value={String(block.gp)} />
                  <Tile
                    label="Wins"
                    value={String(block.wins)}
                    sub={block.gp ? `${Math.round((block.wins / block.gp) * 100)}% win rate` : undefined}
                  />
                  <Tile label="Podiums" value={String(block.podiums)} sub={block.gp ? `${Math.round((block.podiums / block.gp) * 100)}% of GPs` : undefined} />
                  <Tile
                    label="Avg finish"
                    value={block.avg_finish !== null ? `P${block.avg_finish}` : "—"}
                    sub={block.best_finish !== null ? `best P${block.best_finish}` : undefined}
                  />
                </div>

                {/* Chart */}
                <div className="rounded-xl border border-white/10 bg-[#101016] px-4 pt-3 pb-2 mb-5">
                  <p className="text-white text-sm font-semibold">
                    {effectiveView === "season"
                      ? `Season ${kind === "elo" ? "Elo" : "rating"} after each GP`
                      : `Global ${kind === "elo" ? "Elo" : "rating"} at the end of each season`}
                  </p>
                  <p className="text-[#9ca3af] text-xs mb-2">
                    {effectiveView === "season"
                      ? `${stats.current_season.month_name} · ${block.gp} GP${block.gp !== 1 ? "s" : ""}`
                      : "After their last GP of each month · 🏆 season won"}
                  </p>
                  {effectiveView === "season"
                    ? (
                      <SeasonLineChart
                        series={stats.current_season.series}
                        kind={stats.current_season.kind}
                        start={stats.current_season.elo_start}
                        height={mobile ? 160 : 190}
                      />
                    )
                    : <SeasonEndRatingChart seasons={stats.seasons} height={mobile ? 180 : 210} />}
                </div>

                {/* Form */}
                <p className="text-[#9ca3af] text-xs uppercase tracking-widest mb-2">
                  Last {block.recent.length} GP{block.recent.length !== 1 ? "s" : ""}
                </p>
                {block.recent.length === 0 ? (
                  <p className="text-[#6b7280] text-sm">No GP yet.</p>
                ) : (
                  <div className="flex flex-wrap">
                    {block.recent.map((r) => {
                      const chip = FINISH_CHIP[r.position];
                      return (
                        <div key={r.match_id} className="mr-2 mb-2 flex flex-col items-center">
                          <div
                            className="w-11 h-11 rounded-lg flex items-center justify-center font-racing text-sm"
                            style={chip
                              ? { background: chip.bg, color: chip.fg }
                              : { background: "rgba(255,255,255,0.06)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.12)" }}
                          >
                            P{r.position}
                          </div>
                          <span className="text-[#6b7280] text-[10px] mt-1 tabular-nums">
                            {new Date(r.played_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <p className="text-[#4b5563] text-xs text-center mt-3">Closes after 15 s without interaction · tap outside to dismiss</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-2 mb-1 px-2.5 py-1 rounded-full text-xs font-semibold text-[#e5e7eb] bg-white/5 border border-white/10">
      {children}
    </span>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[#9ca3af] text-[11px] uppercase tracking-widest">{label}</p>
      <p className="font-racing text-white text-2xl tabular-nums leading-tight mt-1">{value}</p>
      {sub && <p className="text-[#6b7280] text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function Delta({ value, kind }: { value: number | null; kind: SeasonKind }) {
  if (value === null || Math.abs(value) < deltaThreshold(kind)) return null;
  const up = value > 0;
  return (
    <span
      className="ml-3 mb-1 px-2 py-0.5 rounded-md text-sm font-semibold tabular-nums"
      style={{ color: up ? "#4ade80" : "#f87171", background: up ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)" }}
      title="Change from the last GP"
    >
      {up ? "▲" : "▼"} {formatSeasonDelta(value, kind).slice(1)}
    </span>
  );
}
