import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import type { RaceSubmission } from "@/types";

function validateRaces(races: unknown, gpPlayers: Set<string>): string | null {
  if (!Array.isArray(races) || races.length < 2 || races.length > 6) return "A GP has 2 to 6 races";
  for (const [i, race] of (races as RaceSubmission[]).entries()) {
    const label = `Race ${i + 1}`;
    if (!race || typeof race.track_id !== "string" || !race.track_id) return `${label}: pick a track`;
    if (!Array.isArray(race.finishes) || race.finishes.length === 0) return `${label}: no positions`;
    const ids = race.finishes.map((f) => f.player_id);
    const positions = race.finishes.map((f) => f.position);
    if (ids.some((id) => !gpPlayers.has(id))) return `${label}: a racer isn't part of this GP`;
    if (new Set(ids).size !== ids.length) return `${label}: a racer appears twice`;
    if (positions.some((p) => !Number.isInteger(p) || p < 1 || p > 24)) return `${label}: positions must be 1–24`;
    if (new Set(positions).size !== positions.length) return `${label}: two racers can't share a position`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.results) || body.results.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const results: { player_id: string; position: number }[] = body.results;

  const positions = results.map((r) => r.position);
  const uniquePlayerIds = new Set(results.map((r) => r.player_id));
  if (
    uniquePlayerIds.size !== results.length ||
    positions.some((p) => !Number.isInteger(p) || p < 1 || p > 24)
  ) {
    return NextResponse.json(
      { error: "Each player must appear once; positions must be integers 1–24" },
      { status: 400 }
    );
  }

  // Optional race-by-race details: informational only, never used by the Elo.
  const races: RaceSubmission[] | undefined = body.races;
  const supabase = getServerSupabase();
  if (races !== undefined && races !== null) {
    const raceError = validateRaces(races, uniquePlayerIds);
    if (raceError) return NextResponse.json({ error: raceError }, { status: 400 });

    const trackIds = [...new Set(races.map((r) => r.track_id))];
    const { data: known, error: trackError } = await supabase.from("tracks").select("id").in("id", trackIds);
    if (trackError) return NextResponse.json({ error: trackError.message }, { status: 500 });
    if ((known ?? []).length !== trackIds.length) {
      return NextResponse.json({ error: "Unknown track" }, { status: 400 });
    }
  }

  // Saves the match, its results, its races and its frozen scores in one transaction.
  const { data: matchId, error } = await supabase.rpc("submit_gp", {
    p_results: results.map(({ player_id, position }) => ({ player_id, position })),
    ...(races ? {
      p_races: races.map((r) => ({
        track_id: r.track_id,
        finishes: r.finishes.map(({ player_id, position }) => ({ player_id, position })),
      })),
    } : {}),
  });

  if (error || !matchId) {
    return NextResponse.json({ error: error?.message ?? "Failed to submit GP" }, { status: 500 });
  }

  return NextResponse.json({ match_id: matchId }, { status: 201 });
}
