import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  toYearMonth, monthName, daysInMonth, daysLeft,
  computeRatings, computeSeasonWins, BAYESIAN_PRIOR,
  type MatchRow, type ResultRow, type PlayerRow,
} from "@/lib/season";
import type { SeasonInfo, SeasonPlayer } from "@/types";

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
  const hasGames = byMonth.has(nowYM);

  if (sortedMonths.length === 0) {
    const season_info: SeasonInfo = {
      season_number: 1,
      year_month: nowYM,
      month_name: monthName(nowYM),
      days_left: daysLeft(nowYM),
      days_total: daysInMonth(nowYM),
      has_games: false,
    };
    return NextResponse.json({ season_info, ranking: [] });
  }

  const currentSeasonNumber = sortedMonths.indexOf(nowYM) + 1;
  const seasonNumber = hasGames ? currentSeasonNumber : sortedMonths.length + 1;

  const season_info: SeasonInfo = {
    season_number: seasonNumber,
    year_month: nowYM,
    month_name: monthName(nowYM),
    days_left: daysLeft(nowYM),
    days_total: daysInMonth(nowYM),
    has_games: hasGames,
  };

  const seasonWins = computeSeasonWins(sortedMonths, byMonth, results, players, nowYM);

  const currentMatchIds = byMonth.get(nowYM) ?? [];
  const currentRatings = computeRatings(currentMatchIds, results);

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const ranking: SeasonPlayer[] = [...currentRatings.entries()]
    .flatMap(([pid, { points, gp }]): SeasonPlayer[] => {
      const p = playerMap.get(pid);
      if (!p) return [];
      return [{
        player_id: pid,
        name: p.name,
        character_avatar: p.character_avatar,
        avatar_url: p.avatar_url ?? null,
        season_rating: points / (BAYESIAN_PRIOR + gp),
        season_gp: gp,
        season_wins: seasonWins.get(pid) ?? 0,
      }];
    })
    .sort((a, b) => b.season_rating - a.season_rating || a.name.localeCompare(b.name));

  for (const p of players) {
    if (!currentRatings.has(p.id) && (seasonWins.get(p.id) ?? 0) > 0) {
      ranking.push({
        player_id: p.id,
        name: p.name,
        character_avatar: p.character_avatar,
        avatar_url: p.avatar_url,
        season_rating: 0,
        season_gp: 0,
        season_wins: seasonWins.get(p.id) ?? 0,
      });
    }
  }

  return NextResponse.json({ season_info, ranking });
}
