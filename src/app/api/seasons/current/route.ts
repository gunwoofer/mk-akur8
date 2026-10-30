import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  currentYearMonth, monthName, daysInMonth, daysLeft,
  loadSeasonData, seasonStandings, computeSeasonWins, rankKey, toSeasonPlayer,
  type SeasonStanding,
} from "@/lib/season";
import { compareRank } from "@/lib/ranking";
import type { SeasonInfo } from "@/types";

export async function GET() {
  const data = await loadSeasonData(getServerSupabase());
  const nowYM = currentYearMonth();
  const hasGames = data.byMonth.has(nowYM);

  const season_info: SeasonInfo = {
    season_number: hasGames ? data.sortedMonths.indexOf(nowYM) + 1 : data.sortedMonths.length + 1,
    year_month: nowYM,
    month_name: monthName(nowYM),
    days_left: daysLeft(nowYM),
    days_total: daysInMonth(nowYM),
    has_games: hasGames,
  };

  const seasonWins = computeSeasonWins(data, nowYM);
  const standings = seasonStandings(data.byMonth.get(nowYM) ?? [], data);

  // Past season winners stay on the board even before they play this month.
  const playing = new Set(standings.map((s) => s.player.id));
  const idleWinners: SeasonStanding[] = data.players
    .filter((p) => !playing.has(p.id) && (seasonWins.get(p.id) ?? 0) > 0)
    .map((player) => ({ player, points: 0, gp: 0, p1: 0, rating: 0 }));

  const ranking = [...standings, ...idleWinners]
    .sort((a, b) => compareRank(rankKey(a), rankKey(b)))
    .map((s) => toSeasonPlayer(s, seasonWins));

  return NextResponse.json({ season_info, ranking });
}
