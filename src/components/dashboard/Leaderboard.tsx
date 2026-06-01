"use client";

import { useState, useEffect } from "react";
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

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

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
    <div className="flex flex-col h-screen w-full px-6 py-5 overflow-hidden">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-[#00d4ff] font-black italic text-5xl tracking-tighter leading-none neon-text">
            MK AKUR8
          </h1>
          <p className="text-gray-600 text-sm tracking-widest uppercase mt-1">
            Office Grand Prix · Live Rankings
          </p>
        </div>
        {/* gap-* replaced with explicit mr-* — flex gap unsupported on iOS 12 */}
        <div className="flex items-center">
          <div className="flex items-center mr-6">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse mr-2" />
            <span className="text-gray-400 text-sm font-medium tracking-wider uppercase">Live</span>
          </div>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="p-1.5 rounded-lg text-gray-700 hover:text-gray-400 transition-colors mr-3"
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]/80 text-gray-400 hover:text-[#00d4ff] hover:border-[#00d4ff] transition-colors text-xs font-semibold uppercase tracking-wider"
          >
            Ranking System
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[3rem_3rem_1fr_6rem_5rem_5rem] gap-4 px-4 mb-2 shrink-0">
        <span className="text-gray-700 text-xs uppercase tracking-wider">#</span>
        <span />
        <span className="text-gray-700 text-xs uppercase tracking-wider">Player</span>
        <span className="text-gray-700 text-xs uppercase tracking-wider text-right">Rating</span>
        <span className="text-gray-700 text-xs uppercase tracking-wider text-right">GPs</span>
        <span className="text-gray-700 text-xs uppercase tracking-wider text-right">Trend</span>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[#00d4ff] text-sm tracking-widest uppercase">Loading</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : players.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-600 text-lg mb-2">No players yet.</p>
              <p className="text-gray-700 text-sm">Use the admin app on your phone to add players and submit results.</p>
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
                  className={`grid grid-cols-[3rem_3rem_1fr_6rem_5rem_5rem] gap-4 items-center px-4 py-3 mb-1 rounded-xl cursor-pointer transition-all border backdrop-blur-sm ${
                    rank === 1
                      ? "bg-yellow-400/15 border-yellow-400/40 hover:bg-yellow-400/20"
                      : "bg-black/60 border-white/10 hover:bg-black/70"
                  }`}
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
                  <p className="text-gray-500 text-sm tabular-nums text-right">{player.gp_played}</p>
                  <div className="flex justify-end items-center">
                    {delta > 0 && <span className="text-green-400 text-lg font-bold">▲</span>}
                    {delta < 0 && <span className="text-red-400 text-lg font-bold">▼</span>}
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
