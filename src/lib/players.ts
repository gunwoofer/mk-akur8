import type { SupabaseClient } from "@supabase/supabase-js";
import { compareRank } from "@/lib/ranking";
import { fetchAll } from "@/lib/fetch-all";
import { currentYearMonth } from "@/lib/season";
import type { Player, SeasonKind } from "@/types";

interface GlobalScoring {
  kind: SeasonKind;
  minGp: number;
}

export async function globalScoring(supabase: SupabaseClient): Promise<GlobalScoring> {
  const { data, error } = await supabase.from("scoring_settings").select("global_elo_from, global_min_gp").single();
  if (error) throw new Error(error.message);
  return {
    kind: data?.global_elo_from && currentYearMonth() >= data.global_elo_from ? "elo" : "average",
    minGp: data?.global_min_gp ?? 0,
  };
}

// Active (or archived) players with their P1 count, in global leaderboard order.
// Global Elo: players under global_min_gp GPs are provisional and listed last —
// their Elo has barely left the starting value and says little about their level.
export async function rankedPlayers(supabase: SupabaseClient, archived = false): Promise<Player[]> {
  const query = supabase.from("players").select("*");
  const [{ data, error }, wins, scoring] = await Promise.all([
    archived ? query.not("archived_at", "is", null) : query.is("archived_at", null),
    fetchAll<{ player_id: string }>((from, to) =>
      supabase.from("race_results").select("player_id").eq("position", 1).order("id").range(from, to)),
    globalScoring(supabase),
  ]);
  if (error) throw new Error(error.message);

  const p1Counts = new Map<string, number>();
  for (const { player_id } of wins) p1Counts.set(player_id, (p1Counts.get(player_id) ?? 0) + 1);

  return ((data ?? []) as Player[])
    .map((p) => ({
      ...p,
      p1_count: p1Counts.get(p.id) ?? 0,
      rating_kind: scoring.kind,
      provisional: scoring.kind === "elo" && p.gp_played < scoring.minGp,
    }))
    .sort((a, b) => Number(a.provisional) - Number(b.provisional) || compareRank(
      { rating: a.rating, p1: a.p1_count, name: a.name },
      { rating: b.rating, p1: b.p1_count, name: b.name },
    ));
}
