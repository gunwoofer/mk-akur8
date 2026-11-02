import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { fetchAll } from "@/lib/fetch-all";
import { rankedPlayers } from "@/lib/players";
import {
  currentYearMonth, monthName, loadSeasonData, seasonStandings, computeSeasonWins, seasonKind, type SeasonData,
} from "@/lib/season";
import type { Player, PlayerStats, SeasonKind, SeasonRecord, StatBlock } from "@/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { avatar_url?: string | null; archived?: boolean };
  const update: { avatar_url?: string | null; archived_at?: string | null } = {};
  if ("avatar_url" in body) update.avatar_url = body.avatar_url ?? null;
  if ("archived" in body) update.archived_at = body.archived ? new Date().toISOString() : null;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("players")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// A player who has raced is archived instead of deleted: deleting would cascade
// through their results and rewrite every GP and season they played in.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServerSupabase();

  const { count, error: countError } = await supabase
    .from("race_results")
    .select("id", { count: "exact", head: true })
    .eq("player_id", id);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("players")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ archived: id });
  }

  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: player, error } = await supabase.from("players").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  let rows: LedgerRow[];
  let ranked: Player[];
  let seasonData: SeasonData;
  try {
    [rows, ranked, seasonData] = await Promise.all([
      fetchAll<LedgerRow>((from, to) =>
        supabase
          .from("rating_changes")
          .select("match_id, played_at, season, position, rating_before, rating_after, season_rating, global_kind")
          .eq("player_id", id)
          .order("played_at")
          .order("match_id")
          .range(from, to)),
      rankedPlayers(supabase),
      loadSeasonData(supabase),
    ]);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const nowYM = currentYearMonth();
  const kind = seasonKind(nowYM, seasonData.scoring);
  // Before a player's first GP of the month, their season score is the starting value.
  const seasonStart = kind === "elo" ? seasonData.scoring.eloStart : 0;
  const seasonRows = rows.filter((r) => r.season === nowYM);
  const seasonStandingsNow = seasonStandings(nowYM, seasonData).filter((s) => !s.player.archived_at);
  const seasonRank = seasonStandingsNow.findIndex((s) => s.player.id === id);
  const globalRank = ranked.findIndex((p) => p.id === id);

  const lastGlobal = rows[rows.length - 1];
  const lastRowBySeason = new Map(rows.map((r) => [r.season, r]));   // rows are oldest first
  const lastSeason = seasonRows[seasonRows.length - 1];
  const prevSeason = seasonRows[seasonRows.length - 2];

  const stats: PlayerStats = {
    player: { ...(player as Player), rating_kind: ranked[0]?.rating_kind ?? "average" },
    season_wins: computeSeasonWins(seasonData, nowYM).get(id) ?? 0,
    current_season: {
      year_month: nowYM,
      month_name: monthName(nowYM),
      kind,
      elo_start: seasonData.scoring.eloStart,
      stats: statBlock(
        seasonRows,
        lastSeason?.season_rating ?? seasonStart,
        lastSeason ? lastSeason.season_rating - (prevSeason?.season_rating ?? seasonStart) : null,
        seasonRank >= 0 ? seasonRank + 1 : null,
        seasonStandingsNow.length,
      ),
      series: seasonRows.map((r) => ({ played_at: r.played_at, rating: r.season_rating, position: r.position })),
    },
    global: statBlock(
      rows,
      (player as Player).rating,
      lastGlobal ? lastGlobal.rating_after - lastGlobal.rating_before : null,
      globalRank >= 0 ? globalRank + 1 : null,
      ranked.length,
    ),
    seasons: seasonData.sortedMonths.flatMap((ym): SeasonRecord[] => {
      const lastOfMonth = lastRowBySeason.get(ym);
      const standings = seasonStandings(ym, seasonData);
      const idx = standings.findIndex((s) => s.player.id === id);
      if (idx < 0) return [];
      return [{
        year_month: ym,
        month_name: monthName(ym),
        rating: standings[idx].rating,
        gp: standings[idx].gp,
        rank: idx + 1,
        won: idx === 0 && ym < nowYM,
        is_current: ym === nowYM,
        kind: standings[idx].kind,
        players: standings.length,
        global_rating_end: lastOfMonth?.rating_after ?? 0,
        global_kind: lastOfMonth?.global_kind ?? "average",
      }];
    }),
  };

  return NextResponse.json(stats);
}

interface LedgerRow {
  match_id: string;
  played_at: string;
  season: string;
  position: number;
  rating_before: number;
  rating_after: number;
  season_rating: number;
  global_kind: SeasonKind;
}

function statBlock(
  rows: LedgerRow[],
  rating: number,
  ratingDelta: number | null,
  rank: number | null,
  rankedPlayers: number,
): StatBlock {
  const positions = rows.map((r) => r.position);
  return {
    rating,
    rating_delta: ratingDelta,
    rank,
    ranked_players: rankedPlayers,
    gp: rows.length,
    wins: positions.filter((p) => p === 1).length,
    podiums: positions.filter((p) => p <= 3).length,
    avg_finish: positions.length ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10 : null,
    best_finish: positions.length ? Math.min(...positions) : null,
    recent: rows.slice(-10).reverse().map((r) => ({ match_id: r.match_id, played_at: r.played_at, position: r.position })),
  };
}
