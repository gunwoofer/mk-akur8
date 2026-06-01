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

  // Always-current ranks — snapshot of the last settled fetch; captured as the
  // frozen baseline when a new GP arrives so subsequent polls keep showing deltas.
  const liveRanksRef = useRef<Record<string, number>>({});
  // Ranks just before the latest GP — only updated on a new committed GP.
  // Delta display uses this so arrows persist until the next GP.
  const frozenBaselineRef = useRef<Record<string, number>>({});
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
      const latestId: string = history.length > 0 ? history[0].match_id : "none";
      const isFirstLoad = lastMatchIdRef.current === undefined;
      const isNewGP = !isFirstLoad && latestId !== "none" && latestId !== lastMatchIdRef.current;
      const latestMatch = history.length > 0 ? (history as HistoryEntry[])[0] : null;
      const gpCommitted = isNewGP && (latestMatch?.results.length ?? 0) > 0;

      if (gpCommitted) {
        // Freeze the pre-GP rankings so delta arrows stay visible until the next GP.
        frozenBaselineRef.current = { ...liveRanksRef.current };
      }

      const frozen = frozenBaselineRef.current;
      const newRanked: RankedPlayer[] = sorted.map((p, i) => ({
        ...p,
        rankDelta: isFirstLoad || frozen[p.id] === undefined
          ? 0
          : frozen[p.id] - (i + 1),
      }));

      liveRanksRef.current = Object.fromEntries(sorted.map((p, i) => [p.id, i + 1]));

      if (isNewGP) {
        if (gpCommitted) {
          const winner = latestMatch!.results[0]; // ordered by position asc — first is best finisher
          if (winner) {
            setCelebrationWinner((prev) => prev ?? { name: winner.name, character_avatar: winner.avatar });
          }
          lastMatchIdRef.current = latestId;
        }
        // else: race_results not yet committed — don't advance ref so we retry next fetch
      } else {
        lastMatchIdRef.current = latestId;
      }

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
      // Direct push from the admin app after a successful GP submission.
      // The broadcast arrives before postgres_changes and carries the winner — this is
      // the primary celebration trigger. The polling path below is the fallback.
      .on("broadcast", { event: "gp_submitted" }, ({ payload }) => {
        if (payload?.name) {
          setCelebrationWinner((prev) => prev ?? { name: payload.name, character_avatar: payload.character_avatar });
        }
        doFetch();
      })
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
