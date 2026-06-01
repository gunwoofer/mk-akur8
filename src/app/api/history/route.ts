import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

interface RaceResultRow {
  player_id: string;
  position: number;
  players: { name: string; character_avatar: string } | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

  const supabase = getServerSupabase();

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, played_at")
    .order("played_at", { ascending: false })
    .range(offset, offset + limit - 1);

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
        results: ((results as unknown as RaceResultRow[]) ?? []).map((r) => ({
          player_id: r.player_id,
          position: r.position,
          name: r.players?.name ?? "Unknown",
          avatar: r.players?.character_avatar ?? "🏎️",
        })),
      };
    })
  );

  return NextResponse.json(history);
}
