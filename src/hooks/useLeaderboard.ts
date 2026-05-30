"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { Player, HistoryEntry } from "@/types";

export interface RankedPlayer extends Player {
  rankDelta: number;
}

export interface CelebrationWinner {
  name: string;
  character_avatar: string;
}

function sortByRating(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) => b.rating - a.rating || a.name.localeCompare(b.name)
  );
}

export function useLeaderboard() {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebrationWinner, setCelebrationWinner] = useState<CelebrationWinner | null>(null);

  // Ranks from the previous settled fetch — used to compute per-player deltas.
  // Mutated outside React state so the Strict Mode double-render doesn't corrupt it.
  const baselineRanksRef = useRef<Record<string, number>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks the last match UUID we displayed; undefined until the first fetch completes.
  // "none" signals there are no matches yet, preventing a false celebration on first GP.
  const lastMatchIdRef = useRef<string | undefined>(undefined);

  const doFetch = useCallback(async () => {
    try {
      const [data, history] = await Promise.all([
        api.players.list(),
        api.history.list(),
      ]);

      const sorted = sortByRating(data);
      const oldRanks = baselineRanksRef.current;
      const isFirstLoad = Object.keys(oldRanks).length === 0;

      const newRanked: RankedPlayer[] = sorted.map((p, i) => ({
        ...p,
        rankDelta: isFirstLoad || oldRanks[p.id] === undefined
          ? 0
          : oldRanks[p.id] - (i + 1),
      }));

      baselineRanksRef.current = Object.fromEntries(sorted.map((p, i) => [p.id, i + 1]));

      const latestId: string = history.length > 0 ? history[0].match_id : "none";

      if (
        lastMatchIdRef.current !== undefined &&
        latestId !== "none" &&
        latestId !== lastMatchIdRef.current
      ) {
        const winner = (history as HistoryEntry[])[0].results.find((r) => r.position === 1);
        if (winner) {
          setCelebrationWinner({ name: winner.name, character_avatar: winner.avatar });
        }
      }
      lastMatchIdRef.current = latestId;

      setPlayers(newRanked);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { doFetch(); }, [doFetch]);

  useEffect(() => {
    const trigger = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // 800 ms debounce lets the DB trigger finish updating all player ratings
      // before we fetch, so we never compare against a partially-updated state.
      debounceRef.current = setTimeout(doFetch, 800);
    };

    const supabase = getSupabase();
    const channel = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*",      schema: "public", table: "players"      }, trigger)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "race_results" }, trigger)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches"      }, trigger)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [doFetch]);

  // Polling fallback — guarantees updates even when the office network drops
  // the WebSocket and Supabase's automatic reconnect hasn't fired yet.
  useEffect(() => {
    const id = setInterval(doFetch, 15_000);
    return () => clearInterval(id);
  }, [doFetch]);

  return {
    players,
    loading,
    error,
    celebrationWinner,
    dismissCelebration: () => setCelebrationWinner(null),
  };
}
