import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.results) || body.results.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const results: { player_id: string; position: number }[] = body.results;

  const positions = results.map((r) => r.position);
  const uniquePositions = new Set(positions);
  if (
    uniquePositions.size !== results.length ||
    positions.some((p) => p < 1 || p > 24)
  ) {
    return NextResponse.json(
      { error: "Positions must be unique integers between 1 and 24" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({})
    .select("id")
    .single();

  if (matchError || !match) {
    return NextResponse.json(
      { error: matchError?.message ?? "Failed to create match" },
      { status: 500 }
    );
  }

  const rows = results.map((r) => ({
    match_id: match.id,
    player_id: r.player_id,
    position: r.position,
  }));

  const { error: resultsError } = await supabase.from("race_results").insert(rows);

  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 });
  }

  return NextResponse.json({ match_id: match.id }, { status: 201 });
}
