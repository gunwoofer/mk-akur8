import type { SupabaseClient } from "@supabase/supabase-js";
import { compareRank } from "@/lib/ranking";
import { fetchAll } from "@/lib/fetch-all";
import type { SeasonKind, SeasonPlayer } from "@/types";

export interface PlayerRow {
  id: string;
  name: string;
  character_avatar: string;
  avatar_url: string | null;
  rating: number;
  archived_at: string | null;
}

interface StandingRow {
  season: string;
  player_id: string;
  season_points: number;
  season_gp: number;
  season_p1: number;
  season_rating: number;
  global_rating: number;
  season_kind: SeasonKind;
}

export interface SeasonStanding {
  player: PlayerRow;
  points: number;
  gp: number;
  p1: number;
  rating: number;
  globalRating: number;
  kind: SeasonKind;
  provisional: boolean;
}

export interface SeasonScoring {
  eloFrom: string;
  eloStart: number;
  minGp: number;
}

export interface SeasonData {
  players: PlayerRow[];
  standings: Map<string, SeasonStanding[]>;
  gpCounts: Map<string, number>;
  sortedMonths: string[];
  scoring: SeasonScoring;
}

const montrealDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Montreal",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function montrealDate(date: Date): { yearMonth: string; day: number } {
  const parts = Object.fromEntries(
    montrealDateFormat.formatToParts(date).map((p) => [p.type, p.value])
  );
  return { yearMonth: `${parts.year}-${parts.month}`, day: Number(parts.day) };
}

export function currentYearMonth(): string {
  return montrealDate(new Date()).yearMonth;
}

export function monthName(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "long" });
}

export function fullMonthName(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}

export function daysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

export function daysLeft(yearMonth: string): number {
  const today = montrealDate(new Date());
  if (yearMonth !== today.yearMonth) return yearMonth > today.yearMonth ? daysInMonth(yearMonth) : 0;
  return daysInMonth(yearMonth) - today.day;
}

export function rankKey(s: SeasonStanding) {
  // Elo seasons don't lean on the global ranking at all, not even to break ties.
  return {
    rating: s.rating,
    p1: s.p1,
    tiebreakRating: s.kind === "elo" ? undefined : s.globalRating,
    name: s.player.name,
  };
}

// Elo seasons: players with enough GPs to win the month rank above provisional ones.
export function compareStandings(a: SeasonStanding, b: SeasonStanding): number {
  if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
  return compareRank(rankKey(a), rankKey(b));
}

export function seasonKind(yearMonth: string, scoring: SeasonScoring): SeasonKind {
  return yearMonth >= scoring.eloFrom ? "elo" : "average";
}

// Season figures are frozen in the rating_changes ledger when each GP is submitted
// (month in Montreal time, season rating, P1s, global rating at that point), so a
// closed season never changes when the scoring rules do.
export async function loadSeasonData(supabase: SupabaseClient): Promise<SeasonData> {
  const [
    standingRows,
    { data: summaryRows, error: summaryError },
    { data: playerRows, error: playerError },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    fetchAll<StandingRow>((from, to) =>
      supabase.from("season_standings").select("*").order("season").order("player_id").range(from, to)),
    supabase.from("season_summaries").select("season, gp_count"),
    supabase.from("players").select("id, name, character_avatar, avatar_url, rating, archived_at"),
    supabase.from("scoring_settings").select("season_elo_from, season_elo_start, season_min_gp").single(),
  ]);

  const firstError = summaryError ?? playerError ?? settingsError;
  if (firstError) throw new Error(firstError.message);
  if (!settings) throw new Error("scoring_settings row is missing");

  const scoring: SeasonScoring = {
    eloFrom: settings.season_elo_from,
    eloStart: settings.season_elo_start,
    minGp: settings.season_min_gp,
  };

  const players = (playerRows ?? []) as PlayerRow[];
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const standings = new Map<string, SeasonStanding[]>();
  for (const row of standingRows) {
    const player = playerMap.get(row.player_id);
    if (!player) continue;
    const list = standings.get(row.season) ?? [];
    list.push({
      player,
      points: row.season_points,
      gp: row.season_gp,
      p1: row.season_p1,
      rating: row.season_rating,
      globalRating: row.global_rating,
      kind: row.season_kind,
      provisional: row.season_kind === "elo" && row.season_gp < scoring.minGp,
    });
    standings.set(row.season, list);
  }
  for (const list of standings.values()) list.sort(compareStandings);

  const gpCounts = new Map((summaryRows ?? []).map((r: { season: string; gp_count: number }) => [r.season, r.gp_count]));

  return { players, standings, gpCounts, sortedMonths: [...gpCounts.keys()].sort(), scoring };
}

export function seasonStandings(yearMonth: string, data: SeasonData): SeasonStanding[] {
  return data.standings.get(yearMonth) ?? [];
}

export function computeSeasonWins(data: SeasonData, upToExclusive: string): Map<string, number> {
  const seasonWins = new Map<string, number>();
  for (const ym of data.sortedMonths) {
    if (ym >= upToExclusive) break;
    const winner = seasonStandings(ym, data)[0];
    if (winner) seasonWins.set(winner.player.id, (seasonWins.get(winner.player.id) ?? 0) + 1);
  }
  return seasonWins;
}

export function toSeasonPlayer(s: SeasonStanding, seasonWins: Map<string, number>): SeasonPlayer {
  return {
    player_id: s.player.id,
    name: s.player.name,
    character_avatar: s.player.character_avatar,
    avatar_url: s.player.avatar_url ?? null,
    season_rating: s.rating,
    season_gp: s.gp,
    season_wins: seasonWins.get(s.player.id) ?? 0,
    season_kind: s.kind,
    provisional: s.provisional,
  };
}
