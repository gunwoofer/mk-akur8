import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { loadFinishes, loadTracks, trackLines, MIN_TRACK_RACES } from "@/lib/tracks";
import type { PlayerTrackStats } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServerSupabase();
  try {
    const [tracks, finishes] = await Promise.all([loadTracks(supabase), loadFinishes(supabase, id)]);
    const order = new Map(tracks.map((t) => [t.id, t.sort_order]));
    const lines = trackLines(finishes, new Map(tracks.map((t) => [t.id, t])))
      .sort((a, b) => (order.get(a.track.id) ?? 0) - (order.get(b.track.id) ?? 0));
    const eligible = lines
      .filter((l) => l.races >= MIN_TRACK_RACES)
      .sort((a, b) => a.avg_finish - b.avg_finish || b.races - a.races);
    const positions = finishes.map((f) => f.position);

    const body: PlayerTrackStats = {
      races: positions.length,
      wins: positions.filter((p) => p === 1).length,
      podiums: positions.filter((p) => p <= 3).length,
      avg_finish: positions.length ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10 : null,
      best: eligible[0] ?? null,
      worst: eligible.length > 1 ? eligible[eligible.length - 1] : null,
      most_played: [...lines].sort((a, b) => b.races - a.races || a.avg_finish - b.avg_finish)[0] ?? null,
      tracks: lines,
      min_races: MIN_TRACK_RACES,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
