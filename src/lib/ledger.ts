import type { SupabaseClient } from "@supabase/supabase-js";

interface GPRow {
  match_id: string;
  player_id: string;
  played_at: string;
  season: string;
}

// Season Elo before a GP = the player's previous ledger row if it's in the same month, else the start value.
export async function seasonRatingsBefore(
  supabase: SupabaseClient,
  rows: GPRow[],
  start: number,
): Promise<Map<string, number>> {
  const before = new Map<string, number>();
  await Promise.all(rows.map(async (r) => {
    const { data, error } = await supabase.from("rating_changes")
      .select("match_id, played_at, season, season_rating")
      .eq("player_id", r.player_id).lte("played_at", r.played_at)
      .order("played_at", { ascending: false }).order("match_id", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    const at = new Date(r.played_at).getTime();
    const prev = (data ?? []).find((p) => {
      const t = new Date(p.played_at).getTime();
      return t < at || (t === at && p.match_id < r.match_id);
    });
    before.set(r.player_id, prev && prev.season === r.season ? prev.season_rating : start);
  }));
  return before;
}
