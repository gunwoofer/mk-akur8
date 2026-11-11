import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetch-all";

export interface StreakGP {
  match_id: string;
  players: string[];
  soloWinner: string | null;   // best human finish, unshared; a shared first place wins nobody a streak
}

// Every GP, oldest first.
export async function loadStreakGPs(supabase: SupabaseClient): Promise<StreakGP[]> {
  const [matches, rows] = await Promise.all([
    fetchAll<{ id: string }>((from, to) =>
      supabase.from("matches").select("id").order("played_at").order("id").range(from, to)),
    fetchAll<{ match_id: string; player_id: string; position: number }>((from, to) =>
      supabase.from("race_results").select("match_id, player_id, position").order("id").range(from, to)),
  ]);
  const byMatch = new Map<string, { player_id: string; position: number }[]>(matches.map((m) => [m.id, []]));
  for (const r of rows) byMatch.get(r.match_id)?.push(r);

  return matches.flatMap((m): StreakGP[] => {
    const results = byMatch.get(m.id) ?? [];
    if (results.length === 0) return [];
    const best = Math.min(...results.map((r) => r.position));
    const winners = results.filter((r) => r.position === best);
    return [{ match_id: m.id, players: results.map((r) => r.player_id), soloWinner: winners.length === 1 ? winners[0].player_id : null }];
  });
}

// A streak only breaks when the player races and doesn't win solo; GPs they skip don't count.
// The record goes to the first player to reach the longest streak.
export function walkStreaks(gps: StreakGP[]) {
  const current = new Map<string, number>();
  const best = new Map<string, number>();
  let record: { player_id: string; streak: number } | null = null;
  for (const gp of gps) {
    for (const pid of gp.players) {
      const n = pid === gp.soloWinner ? (current.get(pid) ?? 0) + 1 : 0;
      current.set(pid, n);
      if (n > (best.get(pid) ?? 0)) best.set(pid, n);
      if (n > (record?.streak ?? 0)) record = { player_id: pid, streak: n };
    }
  }
  return { current, best, record };
}
