import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

interface ResultRow {
  position: number;
  match_id: string;
  matches: { played_at: string } | null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServerSupabase();
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: player, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: allResults } = await supabase
    .from("race_results")
    .select("position, match_id, matches(played_at)")
    .eq("player_id", id)
    .order("matches(played_at)", { ascending: false });

  const rows = (allResults as unknown as ResultRow[]) ?? [];
  const allPositions = rows.map((r) => r.position);
  const podiums = allPositions.filter((p) => p <= 3).length;
  const worstFinish = allPositions.length ? Math.max(...allPositions) : 0;
  const avgPlacement = allPositions.length
    ? allPositions.reduce((a, b) => a + b, 0) / allPositions.length
    : 0;

  const recentResults = rows.slice(0, 10).map((r) => ({
    match_id: r.match_id,
    played_at: r.matches?.played_at ?? null,
    position: r.position,
  }));

  return NextResponse.json({
    player,
    podiums,
    worst_finish: worstFinish,
    avg_placement: Math.round(avgPlacement * 10) / 10,
    recent_results: recentResults,
  });
}
