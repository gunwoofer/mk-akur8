import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetch-all";
import type { Track, TrackLine } from "@/types";

// Below this many races on a track, an average finish says too little to call it
// someone's best/worst track or crown a king.
export const MIN_TRACK_RACES = 3;

// Mario Kart World points per race, 1st → 24th. Only used to pre-fill the final GP
// order from recorded races; the Elo never uses race details.
export const RACE_POINTS = [15, 12, 10, 9, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 1];

export interface FinishRow {
  player_id: string;
  position: number;
  track_id: string;
}

interface RawFinish {
  player_id: string;
  position: number;
  gp_races: { track_id: string } | null;
}

export async function loadTracks(supabase: SupabaseClient): Promise<Track[]> {
  const [{ data, error }, races] = await Promise.all([
    supabase.from("tracks").select("id, name, kind, image, sort_order").eq("active", true),
    fetchAll<{ id: string; track_id: string }>((from, to) =>
      supabase.from("gp_races").select("id, track_id").order("id").range(from, to)),
  ]);
  if (error) throw new Error(error.message);

  const plays = new Map<string, number>();
  for (const r of races) plays.set(r.track_id, (plays.get(r.track_id) ?? 0) + 1);

  return ((data ?? []) as Omit<Track, "plays">[])
    .map((t) => ({ ...t, plays: plays.get(t.id) ?? 0 }))
    .sort((a, b) => b.plays - a.plays || a.sort_order - b.sort_order);
}

export async function loadFinishes(supabase: SupabaseClient, playerId?: string): Promise<FinishRow[]> {
  const rows = await fetchAll((from, to) => {
    let q = supabase.from("race_finishes").select("player_id, position, gp_races(track_id)");
    if (playerId) q = q.eq("player_id", playerId);
    return q.order("race_id").order("player_id").range(from, to);
  });
  return (rows as unknown as RawFinish[]).flatMap((r) =>
    r.gp_races ? [{ player_id: r.player_id, position: r.position, track_id: r.gp_races.track_id }] : []);
}

export function trackLines(finishes: FinishRow[], tracks: Map<string, Track>): TrackLine[] {
  const byTrack = new Map<string, number[]>();
  for (const f of finishes) {
    const list = byTrack.get(f.track_id) ?? [];
    list.push(f.position);
    byTrack.set(f.track_id, list);
  }
  return [...byTrack.entries()].flatMap(([id, positions]): TrackLine[] => {
    const t = tracks.get(id);
    if (!t) return [];
    return [{
      track: { id: t.id, name: t.name, image: t.image },
      races: positions.length,
      avg_finish: Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10,
      wins: positions.filter((p) => p === 1).length,
      podiums: positions.filter((p) => p <= 3).length,
    }];
  });
}
