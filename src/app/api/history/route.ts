import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import type { HistoryEntry } from "@/types";

interface RaceResultRow {
  match_id: string;
  player_id: string;
  position: number;
  players: { name: string; character_avatar: string; avatar_url: string | null } | null;
}

interface RaceRow {
  match_id: string;
  race_number: number;
  tracks: { id: string; name: string; image: string } | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

  const supabase = getServerSupabase();

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, played_at")
    .order("played_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (matches ?? []).map((m) => m.id);
  if (ids.length === 0) return NextResponse.json([]);

  // At most 50 GPs × 24 players / 6 races, well under the 1000-row cap.
  const [{ data: results, error: resultsError }, { data: races, error: racesError }] = await Promise.all([
    supabase.from("race_results")
      .select("match_id, player_id, position, players(name, character_avatar, avatar_url)")
      .in("match_id", ids).order("position").order("player_id"),
    supabase.from("gp_races")
      .select("match_id, race_number, tracks(id, name, image)")
      .in("match_id", ids).order("race_number"),
  ]);
  if (resultsError || racesError) {
    return NextResponse.json({ error: (resultsError ?? racesError)!.message }, { status: 500 });
  }

  const resultRows = (results as unknown as RaceResultRow[]) ?? [];
  const raceRows = (races as unknown as RaceRow[]) ?? [];

  const history: HistoryEntry[] = (matches ?? []).map((match) => ({
    match_id: match.id,
    played_at: match.played_at,
    results: resultRows.filter((r) => r.match_id === match.id).map((r) => ({
      player_id: r.player_id,
      position: r.position,
      name: r.players?.name ?? "Unknown",
      avatar: r.players?.character_avatar ?? "🏎️",
      avatar_url: r.players?.avatar_url ?? null,
    })),
    tracks: raceRows.flatMap((r) => (r.match_id === match.id && r.tracks ? [r.tracks] : [])),
  }));

  return NextResponse.json(history);
}
