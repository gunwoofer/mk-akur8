"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { Player, HistoryEntry, SeasonInfo, SeasonPlayer, BestStreak } from "@/types";

export interface RankedPlayer extends Player {
  rankDelta: number;
  streak?: number;
  season_wins: number;
}

export interface RankedSeasonPlayer extends SeasonPlayer {
  rankDelta: number;
  streak?: number;
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
  const [seasonPlayers, setSeasonPlayers] = useState<RankedSeasonPlayer[]>([]);
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
  const [bestStreak, setBestStreak] = useState<BestStreak | null>(null);
  const [view, setView] = useState<"season" | "global">("season");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebrationWinner, setCelebrationWinner] = useState<CelebrationWinner | null>(null);
  const [gpRecap, setGpRecap] = useState<RecapEntry[] | null>(null);

  const liveRanksRef = useRef<Record<string, number>>({});
  const liveRatingsRef = useRef<Record<string, number>>({});
  const frozenBaselineRef = useRef<Record<string, number>>({});
  const frozenRatingsRef = useRef<Record<string, number>>({});

  // Season rank refs — same pattern as global
  const liveSeasonRanksRef = useRef<Record<string, number>>({});
  const frozenSeasonBaselineRef = useRef<Record<string, number>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMatchIdRef = useRef<string | undefined>(undefined);

  const doFetch = useCallback(async () => {
    try {
      const [data, history, streakData, seasonData] = await Promise.all([
        api.players.list(),
        api.history.list(),
        api.streak.get(),
        api.seasons.current(),
      ]);

      const sorted = sortByRating(data);
      const latestId: string = history.length > 0 ? history[0].match_id : "none";
      const isFirstLoad = lastMatchIdRef.current === undefined;
      const isNewGP = !isFirstLoad && latestId !== "none" && latestId !== lastMatchIdRef.current;
      const latestMatch = history.length > 0 ? (history as HistoryEntry[])[0] : null;
      const gpCommitted = isNewGP && (latestMatch?.results.length ?? 0) > 0;

      if (gpCommitted) {
        frozenBaselineRef.current = { ...liveRanksRef.current };
        frozenRatingsRef.current = { ...liveRatingsRef.current };
        frozenSeasonBaselineRef.current = { ...liveSeasonRanksRef.current };
      }

      // Build season_wins lookup from season ranking
      const seasonWinsById = new Map(
        (seasonData?.ranking ?? []).map((p) => [p.player_id, p.season_wins])
      );

      const frozenGlobal = frozenBaselineRef.current;
      const newRanked: RankedPlayer[] = sorted.map((p, i) => ({
        ...p,
        rankDelta: isFirstLoad || frozenGlobal[p.id] === undefined
          ? 0
          : frozenGlobal[p.id] - (i + 1),
        streak: streakData?.streaks[p.id],
        season_wins: seasonWinsById.get(p.id) ?? 0,
      }));

      liveRanksRef.current = Object.fromEntries(sorted.map((p, i) => [p.id, i + 1]));
      liveRatingsRef.current = Object.fromEntries(data.map((p) => [p.id, p.rating]));

      // Build season ranking with rank deltas
      const frozenSeason = frozenSeasonBaselineRef.current;
      const newSeasonRanked: RankedSeasonPlayer[] = (seasonData?.ranking ?? []).map((p, i) => ({
        ...p,
        rankDelta: isFirstLoad || frozenSeason[p.player_id] === undefined
          ? 0
          : frozenSeason[p.player_id] - (i + 1),
        streak: streakData?.streaks[p.player_id],
      }));

      liveSeasonRanksRef.current = Object.fromEntries(
        (seasonData?.ranking ?? []).map((p, i) => [p.player_id, i + 1])
      );

      if (seasonData?.season_info) setSeasonInfo(seasonData.season_info);
      if (streakData?.best_ever) setBestStreak(streakData.best_ever);

      if (isNewGP) {
        if (gpCommitted) {
          const topPosition = latestMatch!.results[0]?.position;
          const topResults = latestMatch!.results.filter((r) => r.position === topPosition);
          if (topResults.length > 0) {
            setCelebrationWinner((prev) => prev ?? {
              winners: topResults.map((r) => ({ name: r.name, character_avatar: r.avatar, avatar_url: r.avatar_url })),
            });
          }

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
      } else {
        lastMatchIdRef.current = latestId;
      }

      setPlayers(newRanked);
      setSeasonPlayers(newSeasonRanked);
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
    seasonPlayers,
    seasonInfo,
    bestStreak,
    view,
    setView,
    loading,
    error,
    celebrationWinner,
    dismissCelebration: () => setCelebrationWinner(null),
    gpRecap,
    clearRecap: () => setGpRecap(null),
  };
}
