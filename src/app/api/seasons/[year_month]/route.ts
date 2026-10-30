import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  currentYearMonth, loadSeasonData, seasonStandings, computeSeasonWins, toSeasonPlayer,
} from "@/lib/season";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ year_month: string }> }
) {
  const { year_month } = await params;

  if (!/^\d{4}-\d{2}$/.test(year_month)) {
    return NextResponse.json({ error: "Invalid year_month format" }, { status: 400 });
  }

  const data = await loadSeasonData(getServerSupabase());
  const targetMatchIds = data.byMonth.get(year_month) ?? [];
  if (targetMatchIds.length === 0) {
    return NextResponse.json({ ranking: [] });
  }

  const seasonWins = computeSeasonWins(data, currentYearMonth());
  const ranking = seasonStandings(targetMatchIds, data).map((s) => toSeasonPlayer(s, seasonWins));

  return NextResponse.json({ ranking });
}
