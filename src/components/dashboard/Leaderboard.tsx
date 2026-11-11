"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { api } from "@/lib/api";
import type { PlayerStats } from "@/types";
import { RankingBoard, type BoardEntry } from "./RankingBoard";
import PlayerModal from "./PlayerModal";
import RankingInfoModal from "./RankingInfoModal";
import CelebrationOverlay from "./CelebrationOverlay";
import GPRecapOverlay from "./GPRecapOverlay";
import OvertakeOverlay from "./OvertakeOverlay";
import SeasonProgressBar from "./SeasonProgressBar";
import SeasonHistoryModal from "./SeasonHistoryModal";
import TracksModal from "./TracksModal";
import GPMathModal from "./GPMathModal";
import GPHistoryModal from "./GPHistoryModal";
import DashboardMenu, { type MenuItem } from "./DashboardMenu";

export default function Leaderboard() {
  const {
    players, seasonPlayers, seasonInfo, bestStreak,
    view, setView,
    loading, error,
    celebrationWinner, dismissCelebration,
    gpRecap, clearRecap,
    overtakes, clearOvertakes,
  } = useLeaderboard();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showSeasonHistory, setShowSeasonHistory] = useState(false);
  const [showTracks, setShowTracks] = useState(false);
  const [showMath, setShowMath] = useState(false);
  const [showGPs, setShowGPs] = useState(false);
  const [statsCache, setStatsCache] = useState<Record<string, PlayerStats>>({});
  const mobile = useIsMobile();

  // Always refetch: the TV runs all day, so a cached copy goes stale after new GPs.
  // The cached copy (if any) shows instantly while the fresh one loads.
  async function openPlayer(id: string) {
    setSelectedId(id);
    try {
      const data = await api.players.stats(id);
      setStatsCache((prev) => ({ ...prev, [id]: data }));
    } catch {
      // stats fail silently
    }
  }

  const isSeason = view === "season";

  const showSeason = isSeason && !!seasonInfo?.has_games;
  const entries: BoardEntry[] = showSeason
    ? seasonPlayers.map((p) => ({
        id: p.player_id, name: p.name, character_avatar: p.character_avatar, avatar_url: p.avatar_url,
        rating: p.season_rating, gp: p.season_gp, rankDelta: p.rankDelta, streak: p.streak, wins: p.season_wins,
        kind: p.season_kind, provisional: p.provisional, requiredGp: seasonInfo?.min_gp,
      }))
    : players.map((p) => ({
        id: p.id, name: p.name, character_avatar: p.character_avatar, avatar_url: p.avatar_url,
        rating: p.rating, gp: p.gp_played, rankDelta: p.rankDelta, streak: p.streak, wins: p.season_wins,
        kind: p.rating_kind, provisional: p.provisional, requiredGp: p.required_gp,
      }));

  const noSeasonGames = isSeason && !!seasonInfo && !seasonInfo.has_games;
  const menu: MenuItem[] = [
    { icon: "🏁", label: "Last GPs", hint: "Every GP and its races", onSelect: () => setShowGPs(true) },
    { icon: "🗺️", label: "Tracks", hint: "Track stats and kings", onSelect: () => setShowTracks(true) },
    { icon: "🧮", label: "GP Math", hint: "How each GP changed the Elo", onSelect: () => setShowMath(true) },
    { icon: "🏆", label: "Past Seasons", hint: "Every month's winner", onSelect: () => setShowSeasonHistory(true) },
    { icon: "📖", label: "Ranking System", hint: "How the Elo works", onSelect: () => setShowInfo(true) },
  ];

  return (
    <div className={mobile ? "flex flex-col min-h-screen w-full px-4 py-4" : "flex flex-col h-screen w-full px-16 py-5 overflow-hidden"}>
      {/* Header */}
      {mobile ? (
        <div className="mb-3 shrink-0">
          <h1 className="font-racing mk-title text-4xl leading-none pr-2">MK AKUR8</h1>
          <p className="text-[#e5e7eb] text-xs tracking-widest uppercase mt-1 text-outline">
            Office Grand Prix · Live Rankings
          </p>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
              <span className="text-[#e5e7eb] text-xs font-medium tracking-wider uppercase">Live</span>
            </div>
            {bestStreak && (
              <p className="font-racing text-outline text-orange-400 text-sm leading-tight">
                <span className="text-[#cbd5e1] text-[10px] not-italic uppercase tracking-wider mr-1">Best streak</span>
                🔥{bestStreak.streak} <span className="text-white">{bestStreak.player_name.toUpperCase()}</span>
              </p>
            )}
          </div>
        </div>
      ) : (
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
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse mr-2" />
            <span className="text-[#e5e7eb] text-sm font-medium tracking-wider uppercase">Live</span>
          </div>
        </div>
      </div>
      )}

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
        {!mobile && noSeasonGames && (
          <p className="text-[#cbd5e1] text-xs text-outline ml-4">No GPs played this month yet — showing global ranking</p>
        )}
        <div className="ml-auto pl-4">
          <DashboardMenu items={menu} />
        </div>
      </div>
      {mobile && noSeasonGames && (
        <p className="text-[#cbd5e1] text-xs text-outline mt-1 mb-1 shrink-0">No GPs played this month yet — showing global ranking</p>
      )}

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
        <RankingBoard
          entries={entries}
          onOpen={openPlayer}
          mobile={mobile}
          unrankedLabel={showSeason ? "Not eligible yet" : "Not ranked yet"}
        />
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
            streak={players.find((p) => p.id === selectedId)?.streak}
            bestStreak={players.find((p) => p.id === selectedId)?.best_streak}
            isRecord={!!bestStreak && bestStreak.player_id === selectedId}
            initialView={showSeason ? "season" : "global"}
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
        {showTracks && <TracksModal onClose={() => setShowTracks(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showGPs && <GPHistoryModal onClose={() => setShowGPs(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showMath && <GPMathModal initialScope={isSeason ? "season" : "global"} onClose={() => setShowMath(false)} />}
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

      {/* Sequence after a GP: celebration → season recap → overtakes */}
      <AnimatePresence>
        {!celebrationWinner && !gpRecap && overtakes.length > 0 && (
          <OvertakeOverlay overtakes={overtakes} onDone={clearOvertakes} />
        )}
      </AnimatePresence>
    </div>
  );
}

