import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  currentYearMonth, monthName, daysInMonth, daysLeft,
  loadSeasonData, seasonStandings, computeSeasonWins, compareStandings, seasonKind, toSeasonPlayer,
  type SeasonStanding,
} from "@/lib/season";
import type { SeasonInfo } from "@/types";

export async function GET() {
  const data = await loadSeasonData(getServerSupabase());
  const nowYM = currentYearMonth();
  const hasGames = data.gpCounts.has(nowYM);
  const kind = seasonKind(nowYM, data.scoring);

  const season_info: SeasonInfo = {
    season_number: hasGames ? data.sortedMonths.indexOf(nowYM) + 1 : data.sortedMonths.length + 1,
    year_month: nowYM,
    month_name: monthName(nowYM),
    days_left: daysLeft(nowYM),
    days_total: daysInMonth(nowYM),
    has_games: hasGames,
    kind,
    elo_start: data.scoring.eloStart,
    min_gp: data.scoring.minGp,
  };

  const seasonWins = computeSeasonWins(data, nowYM);
  const standings = seasonStandings(nowYM, data).filter((s) => !s.player.archived_at);

  // Past season winners stay on the board even before they play this month.
  const playing = new Set(standings.map((s) => s.player.id));
  const idleWinners: SeasonStanding[] = data.players
    .filter((p) => !p.archived_at && !playing.has(p.id) && (seasonWins.get(p.id) ?? 0) > 0)
    .map((player) => ({
      player, points: 0, gp: 0, p1: 0,
      rating: kind === "elo" ? data.scoring.eloStart : 0,
      globalRating: player.rating,
      kind,
      provisional: kind === "elo",
    }));

  const ranking = [...standings, ...idleWinners]
    .sort(compareStandings)
    .map((s) => toSeasonPlayer(s, seasonWins));

  return NextResponse.json({ season_info, ranking });
}
