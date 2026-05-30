"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import type { Player, PlayerStats } from "@/types";
import PlayerModal from "./PlayerModal";
import RankingInfoModal from "./RankingInfoModal";
import CelebrationOverlay from "./CelebrationOverlay";

interface RankedPlayer extends Player {
  rankDelta: number;
}

function sortByRating(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

export default function Leaderboard() {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [statsCache, setStatsCache] = useState<Record<string, PlayerStats>>({});
  const [celebrationWinner, setCelebrationWinner] = useState<{ name: string; character_avatar: string } | null>(null);

  const baselineRanksRef = useRef<Record<string, number>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // undefined = not yet initialised; "none" = no matches exist; otherwise = latest match UUID
  const lastMatchIdRef = useRef<string | undefined>(undefined);

  const doFetch = useCallback(async () => {
    // Fetch players + history in parallel — celebration detection is self-contained
    const [playersRes, historyRes] = await Promise.all([
      fetch("/api/players"),
      fetch("/api/history"),
    ]);

    if (!playersRes.ok) return;
    const data = sortByRating(await playersRes.json() as Player[]);

    const oldRanks = baselineRanksRef.current;
    const isFirstLoad = Object.keys(oldRanks).length === 0;

    const newRanked: RankedPlayer[] = data.map((p, i) => ({
      ...p,
      rankDelta: isFirstLoad || oldRanks[p.id] === undefined
        ? 0
        : oldRanks[p.id] - (i + 1),
    }));

    baselineRanksRef.current = Object.fromEntries(data.map((p, i) => [p.id, i + 1]));

    // Celebrate when a new match appears that we haven't seen before
    if (historyRes.ok) {
      const history = await historyRes.json() as { match_id: string; results: { position: number; name: string; avatar: string }[] }[];
      const latestId = Array.isArray(history) && history.length > 0 ? history[0].match_id : "none";

      if (
        lastMatchIdRef.current !== undefined &&   // not first load
        latestId !== "none" &&                     // there is at least one match
        latestId !== lastMatchIdRef.current        // it's a new match we haven't seen
      ) {
        const winnerResult = history[0].results.find((r) => r.position === 1);
        if (winnerResult) {
          setCelebrationWinner({ name: winnerResult.name, character_avatar: winnerResult.avatar });
        }
      }

      lastMatchIdRef.current = latestId;
    }

    setPlayers(newRanked);
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // Realtime subscription — debounced refresh on any DB change
  useEffect(() => {
    const trigger = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(doFetch, 800);
    };

    const channel = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, trigger)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "race_results" }, trigger)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, trigger)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [doFetch]);

  // Polling fallback every 15 s — catches new GPs even if realtime is silent
  useEffect(() => {
    const interval = setInterval(doFetch, 15_000);
    return () => clearInterval(interval);
  }, [doFetch]);

  async function openPlayer(id: string) {
    setSelectedId(id);
    if (!statsCache[id]) {
      const res = await fetch(`/api/players/${id}`);
      if (res.ok) {
        const data = await res.json();
        setStatsCache((prev) => ({ ...prev, [id]: data }));
      }
    }
  }

  const medalColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-gray-300";
    if (rank === 3) return "text-amber-600";
    return "text-gray-600";
  };

  return (
    <div className="flex flex-col h-screen w-full px-6 py-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-[#00d4ff] font-black italic text-5xl tracking-tighter leading-none neon-text">
            MK AKUR8
          </h1>
          <p className="text-gray-600 text-sm tracking-widest uppercase mt-1">
            Office Grand Prix · Live Rankings
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-gray-400 text-sm font-medium tracking-wider uppercase">Live</span>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]/80 text-gray-400 hover:text-[#00d4ff] hover:border-[#00d4ff] transition-colors text-xs font-semibold uppercase tracking-wider"
          >
            Ranking System
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[3rem_3rem_1fr_6rem_5rem_5rem] gap-4 px-4 mb-2 shrink-0">
        <span className="text-gray-700 text-xs uppercase tracking-wider">#</span>
        <span />
        <span className="text-gray-700 text-xs uppercase tracking-wider">Player</span>
        <span className="text-gray-700 text-xs uppercase tracking-wider text-right">Rating</span>
        <span className="text-gray-700 text-xs uppercase tracking-wider text-right">GPs</span>
        <span className="text-gray-700 text-xs uppercase tracking-wider text-right">Trend</span>
      </div>

      {/* Leaderboard rows */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#00d4ff] text-sm tracking-widest uppercase">Loading</p>
            </div>
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
                  <span className={`font-black text-2xl italic ${medalColor(rank)}`}>
                    {rank}
                  </span>
                  <span className="text-3xl">{player.character_avatar}</span>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-xl italic truncate leading-tight">
                      {player.name.toUpperCase()}
                    </p>
                  </div>
                  <p className="text-[#00d4ff] font-black text-2xl italic tabular-nums text-right">
                    {player.rating.toFixed(2)}
                  </p>
                  <p className="text-gray-500 text-sm tabular-nums text-right">
                    {player.gp_played}
                  </p>
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
            key={celebrationWinner.name + Date.now()}
            winner={celebrationWinner}
            onDone={() => setCelebrationWinner(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
