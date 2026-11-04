import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { loadFinishes, loadTracks, MIN_TRACK_RACES } from "@/lib/tracks";
import type { TrackOverview, TracksOverview } from "@/types";

export async function GET() {
  const supabase = getServerSupabase();
  try {
    const [tracks, finishes, { data: players, error }] = await Promise.all([
      loadTracks(supabase),
      loadFinishes(supabase),
      supabase.from("players").select("id, name, character_avatar, avatar_url"),
    ]);
    if (error) throw new Error(error.message);
    const playerMap = new Map((players ?? []).map((p) => [p.id, p]));

    const overview: TrackOverview[] = tracks.map((t) => {
      const here = finishes.filter((f) => f.track_id === t.id);
      const byPlayer = new Map<string, number[]>();
      for (const f of here) byPlayer.set(f.player_id, [...(byPlayer.get(f.player_id) ?? []), f.position]);

      let king: TrackOverview["king"] = null;
      for (const [pid, positions] of byPlayer) {
        if (positions.length < MIN_TRACK_RACES) continue;
        const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
        const p = playerMap.get(pid);
        if (p && (!king || avg < king.avg_finish)) {
          king = { player_id: pid, name: p.name, character_avatar: p.character_avatar, avatar_url: p.avatar_url, avg_finish: Math.round(avg * 10) / 10, races: positions.length };
        }
      }

      return {
        track: { id: t.id, name: t.name, image: t.image, kind: t.kind },
        races: t.plays,
        avg_finish: here.length ? Math.round((here.reduce((a, f) => a + f.position, 0) / here.length) * 10) / 10 : null,
        king,
      };
    });

    const rated = overview.filter((o) => o.races >= MIN_TRACK_RACES && o.avg_finish !== null);
    const byAvg = [...rated].sort((a, b) => a.avg_finish! - b.avg_finish!);

    const body: TracksOverview = {
      tracks: overview,
      easiest: byAvg[0]?.track.id ?? null,
      hardest: byAvg.length > 1 ? byAvg[byAvg.length - 1].track.id : null,
      min_races: MIN_TRACK_RACES,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
