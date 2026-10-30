import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import type { ScoringConfig } from "@/types";

export async function GET() {
  const supabase = getServerSupabase();
  const [{ data: points, error: pointsError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("position_points").select("position, points").order("position"),
    supabase.from("scoring_settings").select("global_prior, season_prior").single(),
  ]);

  if (pointsError || settingsError || !points || !settings) {
    return NextResponse.json(
      { error: pointsError?.message ?? settingsError?.message ?? "Scoring config missing" },
      { status: 500 }
    );
  }

  const config: ScoringConfig = { points, ...settings };
  return NextResponse.json(config);
}
