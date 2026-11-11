import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { loadStreakGPs, walkStreaks } from "@/lib/streaks";

export async function GET() {
  const supabase = getServerSupabase();
  try {
    const [gps, { data: playerRows }] = await Promise.all([
      loadStreakGPs(supabase),
      supabase.from("players").select("id, name"),
    ]);
    if (gps.length === 0) return NextResponse.json(null);

    const { current, record } = walkStreaks(gps);
    const streaks: Record<string, number> = {};
    for (const [pid, n] of current) if (n >= 1) streaks[pid] = n;

    const best_ever = record
      ? { ...record, player_name: playerRows?.find((p) => p.id === record.player_id)?.name ?? "Unknown" }
      : null;
    return NextResponse.json({ streaks, best_ever });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
