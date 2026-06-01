"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { api } from "@/lib/api";
import type { PlayerStats } from "@/types";
import PlayerModal from "./PlayerModal";
import RankingInfoModal from "./RankingInfoModal";
import CelebrationOverlay from "./CelebrationOverlay";

function medalColor(rank: number) {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-gray-300";
  if (rank === 3) return "text-amber-600";
  return "text-gray-600";
}

export default function Leaderboard() {
  const { players, loading, error, celebrationWinner, dismissCelebration } = useLeaderboard();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [statsCache, setStatsCache] = useState<Record<string, PlayerStats>>({});

  async function openPlayer(id: string) {
    setSelectedId(id);
    if (!statsCache[id]) {
      try {
        const data = await api.players.stats(id);
        setStatsCache((prev) => ({ ...prev, [id]: data }));
      } catch {
        // stats fail silently — modal shows spinner until loaded
      }
    }
  }

  return (
    <div className="flex flex-col h-screen w-full px-16 py-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-[#00d4ff] font-black italic text-5xl tracking-tighter leading-none neon-text">
            MK AKUR8
          </h1>
          <p className="text-[#4b5563] text-sm tracking-widest uppercase mt-1">
            Office Grand Prix · Live Rankings
          </p>
        </div>
        {/* gap-* replaced with explicit mr-* — flex gap unsupported on iOS 12 */}
        <div className="flex items-center">
          <div className="flex items-center mr-6">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse mr-2" />
            <span className="text-[#9ca3af] text-sm font-medium tracking-wider uppercase">Live</span>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#9ca3af] text-xs font-semibold uppercase tracking-wider"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Ranking System
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[3rem_3rem_1fr_6rem_5rem_5rem] gap-4 px-4 mb-2 shrink-0">
        <span className="text-[#374151] text-xs uppercase tracking-wider">#</span>
        <span />
        <span className="text-[#374151] text-xs uppercase tracking-wider">Player</span>
        <span className="text-[#374151] text-xs uppercase tracking-wider text-right">Rating</span>
        <span className="text-[#374151] text-xs uppercase tracking-wider text-right">GPs</span>
        <span className="text-[#374151] text-xs uppercase tracking-wider text-right">Trend</span>
      </div>

      {/* Player list — scrollable so all rows are reachable */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[#00d4ff] text-sm tracking-widest uppercase">Loading</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#f87171] text-sm">{error}</p>
          </div>
        ) : players.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-[#4b5563] text-lg mb-2">No players yet.</p>
              <p className="text-[#374151] text-sm">Use the admin app on your phone to add players and submit results.</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {players.map((player, index) => {
              const rank = index + 1;
              const delta = player.rankDelta;
              return (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  onClick={() => openPlayer(player.id)}
                  className={`grid grid-cols-[3rem_3rem_1fr_6rem_5rem_5rem] gap-4 items-center px-4 py-3 mb-1 rounded-xl cursor-pointer transition-all border ${
                    rank === 1
                      ? "border-[#fac800]/40"
                      : "border-[#ffffff]/10"
                  }`}
                  style={{
                    backgroundColor: rank === 1 ? "rgba(250,200,0,0.08)" : "rgba(0,0,0,0.55)",
                  }}
                >
                  <span className={`font-black text-2xl italic ${medalColor(rank)}`}>{rank}</span>
                  <span className="text-3xl">{player.character_avatar}</span>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-xl italic truncate leading-tight">
                      {player.name.toUpperCase()}
                    </p>
                  </div>
                  <p className="text-[#00d4ff] font-black text-2xl italic tabular-nums text-right">
                    {player.rating.toFixed(2)}
                  </p>
                  <p className="text-[#6b7280] text-sm tabular-nums text-right">{player.gp_played}</p>
                  <div className="flex justify-end items-center">
                    {delta > 0 && <span className="text-[#4ade80] text-lg font-bold">▲</span>}
                    {delta < 0 && <span className="text-[#f87171] text-lg font-bold">▼</span>}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {selectedId && (
          <PlayerModal
            key={selectedId}
            stats={statsCache[selectedId] ?? null}
            playerName={players.find((p) => p.id === selectedId)?.name ?? ""}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInfo && <RankingInfoModal onClose={() => setShowInfo(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {celebrationWinner && (
          <CelebrationOverlay
            winner={celebrationWinner}
            onDone={dismissCelebration}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
