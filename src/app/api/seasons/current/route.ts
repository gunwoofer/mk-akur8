import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  currentYearMonth, monthName, daysInMonth, daysLeft,
  loadSeasonData, seasonStandings, computeSeasonWins, seasonKind, toSeasonPlayer,
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

  // Only players who raced this month are ranked; season wins go out for everyone
  // so trophies still show for champions who haven't played yet.
  const ranking = standings.map((s) => toSeasonPlayer(s, seasonWins));

  return NextResponse.json({ season_info, ranking, season_wins: Object.fromEntries(seasonWins) });
}
