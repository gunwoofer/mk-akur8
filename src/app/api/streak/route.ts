import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

interface ResultRow {
  match_id: string;
  player_id: string;
  position: number;
}

export async function GET() {
  const supabase = getServerSupabase();

  const { data: matchRows, error: matchErr } = await supabase
    .from("matches")
    .select("id")
    .order("played_at", { ascending: false });

  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 });

  const matchIds = (matchRows ?? []).map((m: { id: string }) => m.id);
  if (matchIds.length === 0) return NextResponse.json(null);

  const { data: resultRows, error: resultErr } = await supabase
    .from("race_results")
    .select("match_id, player_id, position")
    .in("match_id", matchIds);

  if (resultErr) return NextResponse.json({ error: resultErr.message }, { status: 500 });

  const rows = (resultRows as ResultRow[]) ?? [];

  // Group results by match, preserving played_at DESC order from matchIds
  const byMatch = new Map<string, { player_id: string; position: number }[]>();
  for (const id of matchIds) byMatch.set(id, []);
  for (const row of rows) byMatch.get(row.match_id)?.push(row);

  // Walk matches newest-first: count consecutive single-winner GPs
  let streakPlayerId: string | null = null;
  let streak = 0;

  for (const id of matchIds) {
    const players = byMatch.get(id) ?? [];
    if (players.length === 0) break;

    const minPos = Math.min(...players.map((p) => p.position));
    const winners = players.filter((p) => p.position === minPos);

    if (winners.length !== 1) break; // tie at P1 — streak resets

    const winnerId = winners[0].player_id;
    if (streak === 0) {
      streakPlayerId = winnerId;
      streak = 1;
    } else if (winnerId === streakPlayerId) {
      streak++;
    } else {
      break;
    }
  }

  return NextResponse.json(streakPlayerId ? { player_id: streakPlayerId, streak } : null);
}
