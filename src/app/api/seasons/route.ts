import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { currentYearMonth, fullMonthName, loadSeasonData, seasonStandings, seasonKind } from "@/lib/season";
import type { SeasonSummary } from "@/types";

export async function GET() {
  const data = await loadSeasonData(getServerSupabase());
  const nowYM = currentYearMonth();

  const seasons: SeasonSummary[] = data.sortedMonths.map((ym, idx) => {
    const standings = seasonStandings(ym, data);
    const winner = standings[0]?.player ?? null;

    return {
      season_number: idx + 1,
      year_month: ym,
      month_name: fullMonthName(ym),
      gp_count: data.gpCounts.get(ym) ?? 0,
      is_current: ym === nowYM,
      kind: seasonKind(ym, data.scoring),
      winner: winner
        ? { player_id: winner.id, name: winner.name, character_avatar: winner.character_avatar, avatar_url: winner.avatar_url }
        : null,
      top3: standings.slice(0, 3).map(({ player, rating }) => ({
        player_id: player.id,
        name: player.name,
        character_avatar: player.character_avatar,
        avatar_url: player.avatar_url,
        season_rating: rating,
      })),
    };
  });

  return NextResponse.json([...seasons].reverse());
}
