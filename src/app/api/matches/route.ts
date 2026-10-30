import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.results) || body.results.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const results: { player_id: string; position: number }[] = body.results;

  const positions = results.map((r) => r.position);
  const uniquePlayerIds = new Set(results.map((r) => r.player_id));
  if (
    uniquePlayerIds.size !== results.length ||
    positions.some((p) => !Number.isInteger(p) || p < 1 || p > 24)
  ) {
    return NextResponse.json(
      { error: "Each player must appear once; positions must be integers 1–24" },
      { status: 400 }
    );
  }

  // Saves the match, its results and its frozen scores in one transaction.
  const { data: matchId, error } = await getServerSupabase().rpc("submit_gp", {
    p_results: results.map(({ player_id, position }) => ({ player_id, position })),
  });

  if (error || !matchId) {
    return NextResponse.json({ error: error?.message ?? "Failed to submit GP" }, { status: 500 });
  }

  return NextResponse.json({ match_id: matchId }, { status: 201 });
}
