import type { SupabaseClient } from "@supabase/supabase-js";
import { compareRank } from "@/lib/ranking";
import { fetchAll } from "@/lib/fetch-all";
import type { Player } from "@/types";

// Active (or archived) players with their P1 count, in global leaderboard order.
export async function rankedPlayers(supabase: SupabaseClient, archived = false): Promise<Player[]> {
  const query = supabase.from("players").select("*");
  const [{ data, error }, wins] = await Promise.all([
    archived ? query.not("archived_at", "is", null) : query.is("archived_at", null),
    fetchAll<{ player_id: string }>((from, to) =>
      supabase.from("race_results").select("player_id").eq("position", 1).order("id").range(from, to)),
  ]);
  if (error) throw new Error(error.message);

  const p1Counts = new Map<string, number>();
  for (const { player_id } of wins) p1Counts.set(player_id, (p1Counts.get(player_id) ?? 0) + 1);

  return ((data ?? []) as Player[])
    .map((p) => ({ ...p, p1_count: p1Counts.get(p.id) ?? 0 }))
    .sort((a, b) => compareRank(
      { rating: a.rating, p1: a.p1_count, name: a.name },
      { rating: b.rating, p1: b.p1_count, name: b.name },
    ));
}
