"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { Player, HistoryEntry } from "@/types";

export interface RankedPlayer extends Player {
  rankDelta: number;
}

export interface WinnerEntry {
  name: string;
  character_avatar: string;
  avatar_url?: string | null;
}

export interface CelebrationWinner {
  winners: WinnerEntry[];
}

export interface RecapEntry {
  player_id: string;
  position: number;
  name: string;
  character_avatar: string;
  avatar_url?: string | null;
  ratingBefore: number;
  ratingAfter: number;
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
  const [gpRecap, setGpRecap] = useState<RecapEntry[] | null>(null);

  // Always-current ranks — overwritten on every settled fetch.
  const liveRanksRef = useRef<Record<string, number>>({});
  // Always-current ratings — overwritten on every settled fetch.
  const liveRatingsRef = useRef<Record<string, number>>({});
  // Ranks just before the latest GP — frozen at gpCommitted so rank arrows persist.
  const frozenBaselineRef = useRef<Record<string, number>>({});
  // Ratings just before the latest GP — used to compute recap deltas.
  const frozenRatingsRef = useRef<Record<string, number>>({});
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
        // Freeze pre-GP ranks and ratings before overwriting the live refs below.
        frozenBaselineRef.current = { ...liveRanksRef.current };
        frozenRatingsRef.current = { ...liveRatingsRef.current };
      }

      const frozen = frozenBaselineRef.current;
      const newRanked: RankedPlayer[] = sorted.map((p, i) => ({
        ...p,
        rankDelta: isFirstLoad || frozen[p.id] === undefined
          ? 0
          : frozen[p.id] - (i + 1),
      }));

      // Update live refs to post-GP values (after frozen snapshots are captured).
      liveRanksRef.current = Object.fromEntries(sorted.map((p, i) => [p.id, i + 1]));
      liveRatingsRef.current = Object.fromEntries(data.map((p) => [p.id, p.rating]));

      if (isNewGP) {
        if (gpCommitted) {
          const topPosition = latestMatch!.results[0]?.position;
          const topResults = latestMatch!.results.filter((r) => r.position === topPosition);
          if (topResults.length > 0) {
            setCelebrationWinner((prev) => prev ?? {
              winners: topResults.map((r) => ({ name: r.name, character_avatar: r.avatar, avatar_url: r.avatar_url })),
            });
          }

          // Build recap: frozenRatingsRef has pre-GP, data has post-GP.
          const recapEntries: RecapEntry[] = latestMatch!.results.map((r) => ({
            player_id: r.player_id,
            position: r.position,
            name: r.name,
            character_avatar: r.avatar,
            avatar_url: r.avatar_url,
            ratingBefore: frozenRatingsRef.current[r.player_id] ?? 0,
            ratingAfter: data.find((p) => p.id === r.player_id)?.rating ?? 0,
          }));
          setGpRecap((prev) => prev ?? recapEntries);

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
      .on("broadcast", { event: "gp_submitted" }, ({ payload }) => {
        if (payload?.winners?.length) {
          setCelebrationWinner((prev) => prev ?? { winners: payload.winners });
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
    gpRecap,
    clearRecap: () => setGpRecap(null),
  };
}
