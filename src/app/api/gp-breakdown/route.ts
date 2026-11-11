import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { seasonRatingsBefore } from "@/lib/ledger";
import type { GPBreakdown, GPBreakdownPlayer, GPBreakdownScope } from "@/types";

interface LedgerRow {
  match_id: string;
  player_id: string;
  played_at: string;
  season: string;
  position: number;
  rating_before: number;
  rating_after: number;
  season_rating: number;
  season_kind: string;
  global_kind: string;
}

const LEDGER = "match_id, player_id, played_at, season, position, rating_before, rating_after, season_rating, season_kind, global_kind";

// Replays score_gp's duels from the ratings everyone had before the GP.
function scope(
  rows: LedgerRow[],
  before: Map<string, number>,
  after: (r: LedgerRow) => number,
  players: Map<string, { name: string; character_avatar: string; avatar_url: string | null }>,
  k: number,
  scale: number,
): GPBreakdownScope {
  const result: GPBreakdownPlayer[] = rows.map((a) => {
    const opponents = rows.filter((b) => b.player_id !== a.player_id);
    const mine = before.get(a.player_id)!;
    const duels = opponents.map((b) => {
      const theirs = before.get(b.player_id)!;
      const score = a.position < b.position ? 1 : a.position === b.position ? 0.5 : 0;
      const expected = 1 / (1 + Math.pow(10, (theirs - mine) / scale));
      return {
        opponent_id: b.player_id,
        name: players.get(b.player_id)?.name ?? "?",
        their_rating: theirs,
        result: score,
        expected,
        points: (k * (score - expected)) / opponents.length,
      };
    });
    const p = players.get(a.player_id);
    return {
      player_id: a.player_id,
      name: p?.name ?? "?",
      character_avatar: p?.character_avatar ?? "",
      avatar_url: p?.avatar_url ?? null,
      position: a.position,
      before: mine,
      after: after(a),
      duels,
    };
  });
  const exact = result.every((p) => Math.abs(p.before + p.duels.reduce((s, d) => s + d.points, 0) - p.after) < 0.01);
  return { players: result, exact };
}

export async function GET(req: NextRequest) {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  const supabase = getServerSupabase();
  try {
    const { data: matches, count, error } = await supabase
      .from("matches").select("id, played_at", { count: "exact" })
      .order("played_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset);
    if (error) throw new Error(error.message);
    const match = matches?.[0];
    if (!match) return NextResponse.json(null);

    const [{ data: ledger, error: ledgerError }, { data: settings, error: settingsError }, { data: playerRows }] = await Promise.all([
      supabase.from("rating_changes").select(LEDGER).eq("match_id", match.id).order("position").order("player_id"),
      supabase.from("scoring_settings").select("season_elo_start, season_elo_k, season_elo_scale").single(),
      supabase.from("players").select("id, name, character_avatar, avatar_url"),
    ]);
    if (ledgerError || settingsError || !settings) throw new Error(ledgerError?.message ?? settingsError?.message ?? "Scoring settings missing");
    const rows = (ledger ?? []) as LedgerRow[];
    const players = new Map((playerRows ?? []).map((p) => [p.id, p]));

    const seasonBefore = await seasonRatingsBefore(supabase, rows, settings.season_elo_start);
    const globalBefore = new Map(rows.map((r) => [r.player_id, r.rating_before]));

    const k = settings.season_elo_k;
    const scale = settings.season_elo_scale;
    const body: GPBreakdown = {
      match_id: match.id,
      played_at: match.played_at,
      offset,
      total: count ?? 0,
      k,
      scale,
      season: rows.length && rows.every((r) => r.season_kind === "elo")
        ? scope(rows, seasonBefore, (r) => r.season_rating, players, k, scale) : null,
      global: rows.length && rows.every((r) => r.global_kind === "elo")
        ? scope(rows, globalBefore, (r) => r.rating_after, players, k, scale) : null,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
