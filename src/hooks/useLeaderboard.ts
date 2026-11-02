"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { compareRank } from "@/lib/ranking";
import type { Player, HistoryEntry, SeasonInfo, SeasonKind, SeasonPlayer, BestStreak } from "@/types";

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
  // Season rating — what people care about after a GP. null before = first GP of the season.
  ratingBefore: number | null;
  ratingAfter: number;
  kind: SeasonKind;
  seasonStart: number;      // Elo starting value — the "before" of a first GP of the month
}

export interface OvertakePlayer {
  name: string;
  character_avatar: string;
  avatar_url?: string | null;
}

export interface Overtake {
  passer: OvertakePlayer;
  passed: OvertakePlayer;
  newRank: number;
  line: string;
}

const TRASH_TALK = [
  "{a} just left {b} in the dust 💨",
  "Check your mirrors, {b} — {a} is coming through!",
  "{a} sends a blue shell {b}'s way 🐢💥",
  "Bye bye {b} 👋 {a} takes P{rank}!",
  "{b} hit a banana. {a} says thanks 🍌",
  "Mushroom boost! {a} zooms past {b} 🍄",
  "{b} was holding the line… until {a} showed up.",
  "{a} to {b}: see you at the finish line 🏁",
];

// Pairs where A was ranked behind B before the GP and is ahead of B now (season ranking).
// Top-of-table overtakes first, at most 3 so the TV doesn't loop for minutes.
function findOvertakes(
  before: Record<string, number>,
  after: { player_id: string; name: string; character_avatar: string; avatar_url?: string | null }[],
): Overtake[] {
  const found: Overtake[] = [];
  after.forEach((a, ia) => {
    after.forEach((b, ib) => {
      if (ia >= ib) return;
      const aBefore = before[a.player_id];
      const bBefore = before[b.player_id];
      if (aBefore === undefined || bBefore === undefined || aBefore <= bBefore) return;
      const template = TRASH_TALK[Math.floor(Math.random() * TRASH_TALK.length)];
      found.push({
        passer: { name: a.name, character_avatar: a.character_avatar, avatar_url: a.avatar_url },
        passed: { name: b.name, character_avatar: b.character_avatar, avatar_url: b.avatar_url },
        newRank: ia + 1,
        line: template.replace(/{a}/g, a.name).replace(/{b}/g, b.name).replace(/{rank}/g, String(ia + 1)),
      });
    });
  });
  return found.sort((x, y) => x.newRank - y.newRank).slice(0, 3);
}

function sortByRating(players: Player[]): Player[] {
  return [...players].sort((a, b) => compareRank(
    { rating: a.rating, p1: a.p1_count ?? 0, name: a.name },
    { rating: b.rating, p1: b.p1_count ?? 0, name: b.name },
  ));
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
  const [overtakes, setOvertakes] = useState<Overtake[]>([]);

  const liveRanksRef = useRef<Record<string, number>>({});
  const liveSeasonRatingsRef = useRef<Record<string, number>>({});
  const frozenBaselineRef = useRef<Record<string, number>>({});
  const frozenSeasonRatingsRef = useRef<Record<string, number>>({});

  // Season rank refs — same pattern as global
  const liveSeasonRanksRef = useRef<Record<string, number>>({});
  const frozenSeasonBaselineRef = useRef<Record<string, number>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMatchIdRef = useRef<string | undefined>(undefined);
  const lastMatchAtRef = useRef(0);

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
      const latestAt = history.length > 0 ? Date.parse(history[0].played_at) : 0;
      const isFirstLoad = lastMatchIdRef.current === undefined;
      // Only a GP newer than the last one seen is new — deleting the latest GP
      // surfaces an older one, which must not be celebrated again.
      const isNewGP = !isFirstLoad && latestId !== "none" && latestId !== lastMatchIdRef.current
        && latestAt > lastMatchAtRef.current;
      const latestMatch = history.length > 0 ? (history as HistoryEntry[])[0] : null;
      const gpCommitted = isNewGP && (latestMatch?.results.length ?? 0) > 0;

      if (gpCommitted) {
        frozenBaselineRef.current = { ...liveRanksRef.current };
        frozenSeasonRatingsRef.current = { ...liveSeasonRatingsRef.current };
        frozenSeasonBaselineRef.current = { ...liveSeasonRanksRef.current };
      }

      // Every player's season wins — not only those ranked this month.
      const seasonWinsById = new Map(Object.entries(seasonData?.season_wins ?? {}));

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
      liveSeasonRatingsRef.current = Object.fromEntries(
        (seasonData?.ranking ?? []).filter((p) => p.season_gp > 0).map((p) => [p.player_id, p.season_rating])
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
            ratingBefore: frozenSeasonRatingsRef.current[r.player_id] ?? null,
            ratingAfter: seasonData?.ranking.find((p) => p.player_id === r.player_id)?.season_rating ?? 0,
            kind: seasonData?.season_info.kind ?? "average",
            seasonStart: seasonData?.season_info.kind === "elo" ? seasonData.season_info.elo_start : 0,
          }));
          setGpRecap((prev) => prev ?? recapEntries);
          setOvertakes(findOvertakes(frozenSeasonBaselineRef.current, seasonData?.ranking ?? []));

          lastMatchIdRef.current = latestId;
          lastMatchAtRef.current = latestAt;
        }
      } else {
        lastMatchIdRef.current = latestId;
        lastMatchAtRef.current = latestAt;
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
    overtakes,
    clearOvertakes: () => setOvertakes([]),
  };
}
