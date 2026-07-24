import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  toYearMonth, fullMonthName, computeRatings, computeWinner, BAYESIAN_PRIOR,
  type MatchRow, type ResultRow, type PlayerRow,
} from "@/lib/season";
import type { SeasonSummary } from "@/types";

export async function GET() {
  const supabase = getServerSupabase();

  const [{ data: matchRows }, { data: resultRows }, { data: playerRows }] = await Promise.all([
    supabase.from("matches").select("id, played_at").order("played_at", { ascending: true }),
    supabase.from("race_results").select("match_id, player_id, position"),
    supabase.from("players").select("id, name, character_avatar, avatar_url, rating"),
  ]);

  const matches = (matchRows ?? []) as MatchRow[];
  const results = (resultRows ?? []) as ResultRow[];
  const players = (playerRows ?? []) as PlayerRow[];

  const byMonth = new Map<string, string[]>();
  for (const m of matches) {
    const ym = toYearMonth(m.played_at);
    const arr = byMonth.get(ym) ?? [];
    arr.push(m.id);
    byMonth.set(ym, arr);
  }

  const sortedMonths = [...byMonth.keys()].sort();
  const nowYM = toYearMonth(new Date().toISOString());
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const seasons: SeasonSummary[] = sortedMonths.map((ym, idx) => {
    const mids = byMonth.get(ym) ?? [];
    const ratings = computeRatings(mids, results);
    const winnerId = computeWinner(mids, results, players);

    const top3 = [...ratings.entries()]
      .map(([pid, { points, gp }]) => ({ pid, rating: points / (BAYESIAN_PRIOR + gp) }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3)
      .flatMap(({ pid, rating }) => {
        const p = playerMap.get(pid);
        if (!p) return [];
        return [{ player_id: pid, name: p.name, character_avatar: p.character_avatar, avatar_url: p.avatar_url, season_rating: rating }];
      });

    const winnerPlayer = winnerId ? playerMap.get(winnerId) : null;

    return {
      season_number: idx + 1,
      year_month: ym,
      month_name: fullMonthName(ym),
      gp_count: mids.length,
      is_current: ym === nowYM,
      winner: winnerPlayer
        ? { player_id: winnerId!, name: winnerPlayer.name, character_avatar: winnerPlayer.character_avatar, avatar_url: winnerPlayer.avatar_url }
        : null,
      top3,
    };
  });

  return NextResponse.json([...seasons].reverse());
}
