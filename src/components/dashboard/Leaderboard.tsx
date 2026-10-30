"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { api } from "@/lib/api";
import type { PlayerStats } from "@/types";
import { RankingBoard, type BoardEntry } from "./RankingBoard";
import PlayerModal from "./PlayerModal";
import RankingInfoModal from "./RankingInfoModal";
import CelebrationOverlay from "./CelebrationOverlay";
import GPRecapOverlay from "./GPRecapOverlay";
import SeasonProgressBar from "./SeasonProgressBar";
import SeasonHistoryModal from "./SeasonHistoryModal";

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

  const showSeason = isSeason && !!seasonInfo?.has_games;
  const entries: BoardEntry[] = showSeason
    ? seasonPlayers.map((p) => ({
        id: p.player_id, name: p.name, character_avatar: p.character_avatar, avatar_url: p.avatar_url,
        rating: p.season_rating, gp: p.season_gp, rankDelta: p.rankDelta, streak: p.streak, wins: p.season_wins,
      }))
    : players.map((p) => ({
        id: p.id, name: p.name, character_avatar: p.character_avatar, avatar_url: p.avatar_url,
        rating: p.rating, gp: p.gp_played, rankDelta: p.rankDelta, streak: p.streak, wins: p.season_wins,
      }));

  const headerButton = "px-3 py-1.5 rounded-lg border border-white/15 bg-black/50 text-[#e5e7eb] text-xs font-semibold uppercase tracking-wider";

  return (
    <div className="flex flex-col h-screen w-full px-16 py-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="font-racing mk-title text-6xl leading-none pr-2">MK AKUR8</h1>
          <p className="text-[#e5e7eb] text-sm tracking-widest uppercase mt-1 text-outline">
            Office Grand Prix · Live Rankings
          </p>
        </div>
        <div className="flex items-center">
          {bestStreak && (
            <div className="mr-6 text-right">
              <p className="text-[#cbd5e1] text-xs uppercase tracking-wider">Best streak</p>
              <p className="font-racing text-outline text-orange-400 text-base leading-tight">
                🔥{bestStreak.streak} <span className="text-white">{bestStreak.player_name.toUpperCase()}</span>
              </p>
            </div>
          )}
          <div className="flex items-center mr-6">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse mr-2" />
            <span className="text-[#e5e7eb] text-sm font-medium tracking-wider uppercase">Live</span>
          </div>
          <button
            onClick={() => setShowSeasonHistory(true)}
            className={`${headerButton} mr-2`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Past Seasons
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className={headerButton}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Ranking System
          </button>
        </div>
      </div>

      <div className="checkered h-3 w-full rounded-sm mb-4 shrink-0 opacity-90" />

      {/* Season progress bar */}
      <SeasonProgressBar info={seasonInfo} />

      {/* Season / Global toggle */}
      <div className="flex items-center mb-1 shrink-0">
        <div className="flex bg-black/60 border border-white/10 rounded-xl p-1">
          {(["season", "global"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`font-racing px-5 py-1.5 rounded-lg text-sm uppercase transition-all ${v === "global" ? "ml-1" : ""} ${
                view === v ? "bg-[#e60012] text-white" : "text-[#9ca3af]"
              }`}
            >
              {v === "season" ? "Season" : "Global"}
            </button>
          ))}
        </div>
        {isSeason && seasonInfo && !seasonInfo.has_games && (
          <p className="ml-4 text-[#cbd5e1] text-xs text-outline">No GPs played this month yet — showing global ranking</p>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-2 border-[#ffd400] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-racing text-[#ffd400] text-sm tracking-widest uppercase">Loading</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#f87171] text-sm">{error}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <p className="text-[#cbd5e1] text-lg mb-2">No players yet.</p>
            <p className="text-[#9ca3af] text-sm">Use the admin app on your phone to add players and submit results.</p>
          </div>
        </div>
      ) : (
        <RankingBoard entries={entries} onOpen={openPlayer} />
      )}

      <AnimatePresence>
        {selectedId && (
          <PlayerModal
            key={selectedId}
            stats={statsCache[selectedId] ?? null}
            playerName={
              players.find((p) => p.id === selectedId)?.name ??
              seasonPlayers.find((p) => p.player_id === selectedId)?.name ?? ""
            }
            seasonWins={players.find((p) => p.id === selectedId)?.season_wins ?? 0}
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

