import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { seasonRatingsBefore } from "@/lib/ledger";
import type { GPDetail, SeasonKind } from "@/types";

interface ResultRow {
  player_id: string;
  position: number;
  players: { name: string; character_avatar: string; avatar_url: string | null } | null;
}

interface LedgerRow {
  match_id: string;
  player_id: string;
  played_at: string;
  season: string;
  rating_before: number;
  rating_after: number;
  season_rating: number;
  season_kind: SeasonKind;
  global_kind: SeasonKind;
}

interface RaceRow {
  race_number: number;
  tracks: { id: string; name: string; image: string } | null;
  race_finishes: { player_id: string; position: number }[];
}

// One GP: final ranking with each player's Elo change, and every recorded race.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServerSupabase();
  try {
    const { data: match, error } = await supabase.from("matches").select("id, played_at").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!match) return NextResponse.json({ error: "GP not found" }, { status: 404 });

    const [results, ledger, races, settings] = await Promise.all([
      supabase.from("race_results")
        .select("player_id, position, players(name, character_avatar, avatar_url)")
        .eq("match_id", id).order("position").order("player_id"),
      supabase.from("rating_changes")
        .select("match_id, player_id, played_at, season, rating_before, rating_after, season_rating, season_kind, global_kind")
        .eq("match_id", id),
      supabase.from("gp_races")
        .select("race_number, tracks(id, name, image), race_finishes(player_id, position)")
        .eq("match_id", id).order("race_number"),
      supabase.from("scoring_settings").select("season_elo_start").single(),
    ]);
    const failed = results.error ?? ledger.error ?? races.error ?? settings.error;
    if (failed) throw new Error(failed.message);

    const ledgerRows = (ledger.data ?? []) as LedgerRow[];
    const byPlayer = new Map(ledgerRows.map((r) => [r.player_id, r]));
    const seasonBefore = await seasonRatingsBefore(supabase, ledgerRows, settings.data!.season_elo_start);

    const body: GPDetail = {
      match_id: match.id,
      played_at: match.played_at,
      results: ((results.data as unknown as ResultRow[]) ?? []).map((r) => {
        const l = byPlayer.get(r.player_id);
        return {
          player_id: r.player_id,
          name: r.players?.name ?? "Unknown",
          character_avatar: r.players?.character_avatar ?? "🏎️",
          avatar_url: r.players?.avatar_url ?? null,
          position: r.position,
          season_delta: l ? l.season_rating - seasonBefore.get(r.player_id)! : null,
          global_delta: l ? l.rating_after - l.rating_before : null,
          season_kind: l?.season_kind ?? "elo",
          global_kind: l?.global_kind ?? "elo",
        };
      }),
      races: ((races.data as unknown as RaceRow[]) ?? []).map((r) => ({
        race_number: r.race_number,
        track: r.tracks,
        finishes: [...r.race_finishes].sort((a, b) => a.position - b.position),
      })),
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Deletes the GP and re-scores every GP played after it.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const { error } = await getServerSupabase().rpc("delete_gp", { p_match: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}
