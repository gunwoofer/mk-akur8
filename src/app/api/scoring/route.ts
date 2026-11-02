import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { currentYearMonth } from "@/lib/season";
import type { ScoringConfig } from "@/types";

export async function GET() {
  const supabase = getServerSupabase();
  const [{ data: points, error: pointsError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("position_points").select("position, points").order("position"),
    supabase.from("scoring_settings")
      .select("global_prior, season_prior, season_elo_from, season_elo_start, season_elo_k, season_elo_scale, season_min_gp, global_elo_from, global_min_gp")
      .single(),
  ]);

  if (pointsError || settingsError || !points || !settings) {
    return NextResponse.json(
      { error: pointsError?.message ?? settingsError?.message ?? "Scoring config missing" },
      { status: 500 }
    );
  }

  const config: ScoringConfig = {
    points,
    ...settings,
    global_kind: settings.global_elo_from && currentYearMonth() >= settings.global_elo_from ? "elo" : "average",
  };
  return NextResponse.json(config);
}
