import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { fetchAll } from "@/lib/fetch-all";

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

  let matchRows: MatchRow[];
  let rows: ResultRow[];
  try {
    [matchRows, rows] = await Promise.all([
      fetchAll<MatchRow>((from, to) =>
        supabase.from("matches").select("id")
          .order("played_at", { ascending: false }).order("id").range(from, to)),
      fetchAll<ResultRow>((from, to) =>
        supabase.from("race_results").select("match_id, player_id, position").order("id").range(from, to)),
    ]);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  const { data: playerRows } = await supabase.from("players").select("id, name");

  const matchIds = matchRows.map((m) => m.id);
  if (matchIds.length === 0) return NextResponse.json(null);

  const playerNameMap = new Map((playerRows ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

  const byMatch = new Map<string, { player_id: string; position: number }[]>();
  for (const id of matchIds) byMatch.set(id, []);
  for (const row of rows) byMatch.get(row.match_id)?.push(row);

  // Current streak — newest-first, per-player.
  // A player's streak only breaks when they participate and don't win solo.
  // Matches they didn't play in are skipped (streak preserved).
  const accumStreaks = new Map<string, number>();
  const finalStreaks = new Map<string, number>();

  for (const id of matchIds) {
    const players = byMatch.get(id) ?? [];
    if (players.length === 0) continue;
    const minPos = Math.min(...players.map((p) => p.position));
    const winners = players.filter((p) => p.position === minPos);
    const soloWinnerId = winners.length === 1 ? winners[0].player_id : null;

    for (const { player_id } of players) {
      if (finalStreaks.has(player_id)) continue;
      if (player_id === soloWinnerId) {
        accumStreaks.set(player_id, (accumStreaks.get(player_id) ?? 0) + 1);
      } else {
        finalStreaks.set(player_id, accumStreaks.get(player_id) ?? 0);
        accumStreaks.delete(player_id);
      }
    }
  }
  for (const [pid, n] of accumStreaks) finalStreaks.set(pid, n);

  const streaks: Record<string, number> = {};
  for (const [pid, n] of finalStreaks) {
    if (n >= 1) streaks[pid] = n;
  }

  // Best ever streak — oldest-first, per-player.
  // Same skip logic: only resets when the player participated and didn't win solo.
  const matchIdsAsc = [...matchIds].reverse();
  const curStreaks = new Map<string, number>();
  const best: Record<string, number> = {};
  let bestPlayerId: string | null = null;
  let bestStreak = 0;

  for (const id of matchIdsAsc) {
    const players = byMatch.get(id) ?? [];
    if (players.length === 0) continue;
    const minPos = Math.min(...players.map((p) => p.position));
    const winners = players.filter((p) => p.position === minPos);
    const soloWinnerId = winners.length === 1 ? winners[0].player_id : null;

    for (const { player_id } of players) {
      if (player_id === soloWinnerId) {
        const n = (curStreaks.get(player_id) ?? 0) + 1;
        curStreaks.set(player_id, n);
        best[player_id] = Math.max(best[player_id] ?? 0, n);
        if (n > bestStreak) {
          bestStreak = n;
          bestPlayerId = player_id;
        }
      } else {
        curStreaks.set(player_id, 0);
      }
    }
  }

  const best_ever = bestPlayerId
    ? { player_id: bestPlayerId, player_name: playerNameMap.get(bestPlayerId) ?? "Unknown", streak: bestStreak }
    : null;

  return NextResponse.json({ streaks, best, best_ever });
}
