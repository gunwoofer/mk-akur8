import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

interface ResultRow {
  match_id: string;
  player_id: string;
  position: number;
}

interface MatchRow {
  id: string;
}

export async function GET() {
  const supabase = getServerSupabase();

  const [{ data: matchRows, error: matchErr }, { data: playerRows }] = await Promise.all([
    supabase.from("matches").select("id").order("played_at", { ascending: false }),
    supabase.from("players").select("id, name"),
  ]);

  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 });

  const matchIds = (matchRows ?? []).map((m: MatchRow) => m.id);
  if (matchIds.length === 0) return NextResponse.json(null);

  const { data: resultRows, error: resultErr } = await supabase
    .from("race_results")
    .select("match_id, player_id, position")
    .in("match_id", matchIds);

  if (resultErr) return NextResponse.json({ error: resultErr.message }, { status: 500 });

  const rows = (resultRows as ResultRow[]) ?? [];
  const playerNameMap = new Map((playerRows ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

  const byMatch = new Map<string, { player_id: string; position: number }[]>();
  for (const id of matchIds) byMatch.set(id, []);
  for (const row of rows) byMatch.get(row.match_id)?.push(row);

  // Current streak — newest-first
  let streakPlayerId: string | null = null;
  let streak = 0;
  for (const id of matchIds) {
    const players = byMatch.get(id) ?? [];
    if (players.length === 0) break;
    const minPos = Math.min(...players.map((p) => p.position));
    const winners = players.filter((p) => p.position === minPos);
    if (winners.length !== 1) break;
    const winnerId = winners[0].player_id;
    if (streak === 0) { streakPlayerId = winnerId; streak = 1; }
    else if (winnerId === streakPlayerId) streak++;
    else break;
  }

  // Best ever streak — oldest-first
  const matchIdsAsc = [...matchIds].reverse();
  let bestPlayerId: string | null = null;
  let bestStreak = 0;
  let curPlayerId: string | null = null;
  let curStreak = 0;
  for (const id of matchIdsAsc) {
    const players = byMatch.get(id) ?? [];
    if (players.length === 0) { curPlayerId = null; curStreak = 0; continue; }
    const minPos = Math.min(...players.map((p) => p.position));
    const winners = players.filter((p) => p.position === minPos);
    if (winners.length !== 1) { curPlayerId = null; curStreak = 0; continue; }
    const winnerId = winners[0].player_id;
    if (winnerId === curPlayerId) {
      curStreak++;
    } else {
      curPlayerId = winnerId;
      curStreak = 1;
    }
    if (curStreak > bestStreak) {
      bestStreak = curStreak;
      bestPlayerId = curPlayerId;
    }
  }

  const best_ever = bestPlayerId
    ? { player_id: bestPlayerId, player_name: playerNameMap.get(bestPlayerId) ?? "Unknown", streak: bestStreak }
    : null;

  return NextResponse.json(
    streakPlayerId
      ? { player_id: streakPlayerId, streak, best_ever }
      : { player_id: null, streak: 0, best_ever }
  );
}
