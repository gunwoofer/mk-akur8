import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  toYearMonth, computeRatings, computeSeasonWins, SEASON_PRIOR,
  type MatchRow, type ResultRow, type PlayerRow,
} from "@/lib/season";
import type { SeasonPlayer } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ year_month: string }> }
) {
  const { year_month } = await params;

  if (!/^\d{4}-\d{2}$/.test(year_month)) {
    return NextResponse.json({ error: "Invalid year_month format" }, { status: 400 });
  }

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

  const targetMatchIds = byMonth.get(year_month) ?? [];
  if (targetMatchIds.length === 0) {
    return NextResponse.json({ ranking: [] });
  }

  const sortedMonths = [...byMonth.keys()].sort();
  const seasonWins = computeSeasonWins(sortedMonths, byMonth, results, players, year_month);
  // Also count the season win for the target month itself (if it's a completed past season)
  const nowYM = toYearMonth(new Date().toISOString());
  const allPastWins = computeSeasonWins(sortedMonths, byMonth, results, players, nowYM);

  const targetRatings = computeRatings(targetMatchIds, results);
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const ranking: SeasonPlayer[] = [...targetRatings.entries()]
    .flatMap(([pid, { points, gp }]): SeasonPlayer[] => {
      const p = playerMap.get(pid);
      if (!p) return [];
      return [{
        player_id: pid,
        name: p.name,
        character_avatar: p.character_avatar,
        avatar_url: p.avatar_url ?? null,
        season_rating: points / (SEASON_PRIOR + gp),
        season_gp: gp,
        season_wins: allPastWins.get(pid) ?? 0,
      }];
    })
    .sort((a, b) => b.season_rating - a.season_rating || a.name.localeCompare(b.name));

  return NextResponse.json({ ranking });
}
