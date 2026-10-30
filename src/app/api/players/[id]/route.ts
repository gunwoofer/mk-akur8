import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { fetchAll } from "@/lib/fetch-all";

interface ResultRow {
  position: number;
  match_id: string;
  matches: { played_at: string } | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { avatar_url?: string | null; archived?: boolean };
  const update: { avatar_url?: string | null; archived_at?: string | null } = {};
  if ("avatar_url" in body) update.avatar_url = body.avatar_url ?? null;
  if ("archived" in body) update.archived_at = body.archived ? new Date().toISOString() : null;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("players")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// A player who has raced is archived instead of deleted: deleting would cascade
// through their results and rewrite every GP and season they played in.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServerSupabase();

  const { count, error: countError } = await supabase
    .from("race_results")
    .select("id", { count: "exact", head: true })
    .eq("player_id", id);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("players")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ archived: id });
  }

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

  const allResults = await fetchAll((from, to) =>
    supabase
      .from("race_results")
      .select("id, position, match_id, matches(played_at)")
      .eq("player_id", id)
      .order("id")
      .range(from, to)
  );

  const rows = (allResults as unknown as ResultRow[]).sort((a, b) =>
    (b.matches?.played_at ?? "").localeCompare(a.matches?.played_at ?? "")
  );
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
