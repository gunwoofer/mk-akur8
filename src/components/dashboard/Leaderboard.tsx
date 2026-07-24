"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { api } from "@/lib/api";
import type { PlayerStats } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";
import PlayerModal from "./PlayerModal";
import RankingInfoModal from "./RankingInfoModal";
import CelebrationOverlay from "./CelebrationOverlay";
import GPRecapOverlay from "./GPRecapOverlay";
import SeasonProgressBar from "./SeasonProgressBar";
import SeasonHistoryModal from "./SeasonHistoryModal";

function medalColor(rank: number) {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-gray-300";
  if (rank === 3) return "text-amber-600";
  return "text-gray-600";
}

function TrophyBadge({ wins }: { wins: number }) {
  if (wins === 0) return null;
  if (wins <= 5) return <span className="text-yellow-400 text-sm leading-none shrink-0">{"🏆".repeat(wins)}</span>;
  return <span className="text-yellow-400 text-sm font-bold leading-none shrink-0">🏆×{wins}</span>;
}

export default function Leaderboard() {
  const {
    players, seasonPlayers, seasonInfo, bestStreak,
    view, setView,
    loading, error,
    celebrationWinner, dismissCelebration,
    gpRecap, clearRecap,
  } = useLeaderboard();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showSeasonHistory, setShowSeasonHistory] = useState(false);
  const [statsCache, setStatsCache] = useState<Record<string, PlayerStats>>({});

  async function openPlayer(id: string) {
    setSelectedId(id);
    if (!statsCache[id]) {
      try {
        const data = await api.players.stats(id);
        setStatsCache((prev) => ({ ...prev, [id]: data }));
      } catch {
        // stats fail silently
      }
    }
  }

  const isSeason = view === "season";

  return (
    <div className="flex flex-col h-screen w-full px-16 py-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-[#00d4ff] font-black italic text-5xl tracking-tighter leading-none neon-text">
            MK AKUR8
          </h1>
          <p className="text-[#4b5563] text-sm tracking-widest uppercase mt-1">
            Office Grand Prix · Live Rankings
          </p>
        </div>
        <div className="flex items-center">
          {/* Best streak banner */}
          {bestStreak && (
            <div className="mr-6 text-right">
              <p className="text-[#9ca3af] text-xs uppercase tracking-wider">Best streak</p>
              <p className="text-orange-400 font-black text-sm leading-tight">
                🔥{bestStreak.streak} <span className="text-white">{bestStreak.player_name.toUpperCase()}</span>
              </p>
            </div>
          )}
          <div className="flex items-center mr-6">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse mr-2" />
            <span className="text-[#9ca3af] text-sm font-medium tracking-wider uppercase">Live</span>
          </div>
          <button
            onClick={() => setShowSeasonHistory(true)}
            className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#9ca3af] text-xs font-semibold uppercase tracking-wider mr-2"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Past Seasons
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#9ca3af] text-xs font-semibold uppercase tracking-wider"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Ranking System
          </button>
        </div>
      </div>

      {/* Season progress bar */}
      <SeasonProgressBar info={seasonInfo} />

      {/* Season / Global toggle */}
      <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1 mb-4 shrink-0 self-start">
        {(["season", "global"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-5 py-1.5 rounded-lg text-sm font-bold capitalize transition-all ${
              view === v ? "bg-[#00d4ff] text-black" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {v === "season" ? "Season" : "Global"}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[3rem_3rem_1fr_6rem_5rem_5rem_5rem] gap-4 px-4 mb-2 shrink-0">
        <span className="text-[#6b7280] text-xs font-semibold uppercase tracking-wider">#</span>
        <span />
        <span className="text-[#6b7280] text-xs font-semibold uppercase tracking-wider">Player</span>
        <span className="text-[#6b7280] text-xs font-semibold uppercase tracking-wider text-right">Rating</span>
        <span className="text-[#6b7280] text-xs font-semibold uppercase tracking-wider text-right">GPs</span>
        <span className="text-[#6b7280] text-xs font-semibold uppercase tracking-wider text-right">Trend</span>
        <span className="text-[#6b7280] text-xs font-semibold uppercase tracking-wider text-right">Seasons won</span>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
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
        ) : isSeason && seasonInfo && !seasonInfo.has_games ? (
          /* No games yet this month — fall through to global but with a notice */
          <div className="flex flex-col h-full">
            <div className="mb-3 px-4 py-2 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#6b7280] text-xs text-center shrink-0">
              No GPs played this month yet — showing global ranking
            </div>
            <AnimatePresence mode="popLayout">
              {players.map((player, index) => (
                <GlobalRow key={player.id} player={player} rank={index + 1} onOpen={openPlayer} />
              ))}
            </AnimatePresence>
          </div>
        ) : isSeason ? (
          /* Season ranking */
          seasonPlayers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <p className="text-[#4b5563] text-lg mb-2">No players yet.</p>
                <p className="text-[#374151] text-sm">Use the admin app on your phone to add players and submit results.</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {seasonPlayers.map((player, index) => {
                const rank = index + 1;
                const delta = player.rankDelta;
                return (
                  <motion.div
                    key={player.player_id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    onClick={() => openPlayer(player.player_id)}
                    className={`grid grid-cols-[3rem_3rem_1fr_6rem_5rem_5rem_5rem] gap-4 items-center px-4 py-3 mb-1 rounded-xl cursor-pointer transition-all border ${
                      rank === 1 ? "border-[#fac800]/40" : "border-[#ffffff]/10"
                    }`}
                    style={{ backgroundColor: rank === 1 ? "rgba(250,200,0,0.08)" : "rgba(0,0,0,0.55)" }}
                  >
                    <span className={`font-black text-2xl italic ${medalColor(rank)}`}>{rank}</span>
                    <AvatarDisplay avatarUrl={player.avatar_url} characterAvatar={player.character_avatar} imgClassName="w-9 h-9" emojiClassName="text-3xl" />
                    <div className="min-w-0 flex items-center">
                      <p className="text-white font-bold text-xl italic truncate leading-tight mr-2">
                        {player.name.toUpperCase()}
                      </p>
                      {player.streak !== undefined && (
                        <span className="shrink-0 text-orange-400 font-bold text-lg leading-none">
                          🔥{player.streak}
                        </span>
                      )}
                    </div>
                    <p className="text-[#00d4ff] font-black text-2xl italic tabular-nums text-right">
                      {player.season_rating.toFixed(2)}
                    </p>
                    <p className="text-[#6b7280] text-sm tabular-nums text-right">{player.season_gp}</p>
                    <div className="flex justify-end items-center">
                      {delta > 0 && <span className="text-[#4ade80] text-lg font-bold">▲</span>}
                      {delta < 0 && <span className="text-[#f87171] text-lg font-bold">▼</span>}
                    </div>
                    <div className="flex justify-end">
                      <TrophyBadge wins={player.season_wins} />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )
        ) : (
          /* Global ranking */
          players.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <p className="text-[#4b5563] text-lg mb-2">No players yet.</p>
                <p className="text-[#374151] text-sm">Use the admin app on your phone to add players and submit results.</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {players.map((player, index) => (
                <GlobalRow key={player.id} player={player} rank={index + 1} onOpen={openPlayer} />
              ))}
            </AnimatePresence>
          )
        )}
      </div>

      <AnimatePresence>
        {selectedId && (
          <PlayerModal
            key={selectedId}
            stats={statsCache[selectedId] ?? null}
            playerName={
              players.find((p) => p.id === selectedId)?.name ??
              seasonPlayers.find((p) => p.player_id === selectedId)?.name ?? ""
            }
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInfo && <RankingInfoModal onClose={() => setShowInfo(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showSeasonHistory && <SeasonHistoryModal onClose={() => setShowSeasonHistory(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {celebrationWinner && (
          <CelebrationOverlay winner={celebrationWinner} onDone={dismissCelebration} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!celebrationWinner && gpRecap && (
          <GPRecapOverlay entries={gpRecap} onDone={clearRecap} />
        )}
      </AnimatePresence>
    </div>
  );
}

function GlobalRow({
  player,
  rank,
  onOpen,
}: {
  player: import("@/hooks/useLeaderboard").RankedPlayer;
  rank: number;
  onOpen: (id: string) => void;
}) {
  const delta = player.rankDelta;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={() => onOpen(player.id)}
      className={`grid grid-cols-[3rem_3rem_1fr_6rem_5rem_5rem_5rem] gap-4 items-center px-4 py-3 mb-1 rounded-xl cursor-pointer transition-all border ${
        rank === 1 ? "border-[#fac800]/40" : "border-[#ffffff]/10"
      }`}
      style={{ backgroundColor: rank === 1 ? "rgba(250,200,0,0.08)" : "rgba(0,0,0,0.55)" }}
    >
      <span className={`font-black text-2xl italic ${medalColor(rank)}`}>{rank}</span>
      <AvatarDisplay avatarUrl={player.avatar_url} characterAvatar={player.character_avatar} imgClassName="w-9 h-9" emojiClassName="text-3xl" />
      <div className="min-w-0 flex items-center">
        <p className="text-white font-bold text-xl italic truncate leading-tight mr-2">
          {player.name.toUpperCase()}
        </p>
        {player.streak !== undefined && (
          <span className="shrink-0 text-orange-400 font-bold text-lg leading-none">
            🔥{player.streak}
          </span>
        )}
      </div>
      <p className="text-[#00d4ff] font-black text-2xl italic tabular-nums text-right">
        {player.rating.toFixed(2)}
      </p>
      <p className="text-[#6b7280] text-sm tabular-nums text-right">{player.gp_played}</p>
      <div className="flex justify-end items-center">
        {delta > 0 && <span className="text-[#4ade80] text-lg font-bold">▲</span>}
        {delta < 0 && <span className="text-[#f87171] text-lg font-bold">▼</span>}
      </div>
      <div className="flex justify-end">
        <TrophyBadge wins={player.season_wins} />
      </div>
    </motion.div>
  );
}
