import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabase = getServerSupabase();

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, played_at")
    .order("played_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const history = await Promise.all(
    (matches ?? []).map(async (match) => {
      const { data: results } = await supabase
        .from("race_results")
        .select("player_id, position, players(name, character_avatar)")
        .eq("match_id", match.id)
        .order("position");

      return {
        match_id: match.id,
        played_at: match.played_at,
        results: (results ?? []).map((r: Record<string, unknown>) => ({
          player_id: r.player_id,
          position: r.position,
          name: (r.players as Record<string, unknown> | null)?.name ?? "Unknown",
          avatar: (r.players as Record<string, unknown> | null)?.character_avatar ?? "🏎️",
        })),
      };
    })
  );

  return NextResponse.json(history);
}
