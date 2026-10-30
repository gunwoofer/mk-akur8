import type { SupabaseClient } from "@supabase/supabase-js";
import { compareRank } from "@/lib/ranking";
import type { SeasonPlayer } from "@/types";

export interface MatchRow {
  id: string;
  played_at: string;
}

export interface ResultRow {
  match_id: string;
  player_id: string;
  position: number;
}

export interface PlayerRow {
  id: string;
  name: string;
  character_avatar: string;
  avatar_url: string | null;
  rating: number;
}

export interface SeasonData {
  results: ResultRow[];
  players: PlayerRow[];
  points: Map<number, number>;
  seasonPrior: number;
  byMonth: Map<string, string[]>;
  sortedMonths: string[];
}

export interface SeasonStanding {
  player: PlayerRow;
  points: number;
  gp: number;
  p1: number;
  rating: number;
}

const TIME_ZONE = "America/Montreal";

const montrealDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
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

export function toYearMonth(iso: string): string {
  return montrealDate(new Date(iso)).yearMonth;
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

export async function loadSeasonData(supabase: SupabaseClient): Promise<SeasonData> {
  const [
    { data: matchRows },
    { data: resultRows },
    { data: playerRows },
    { data: pointRows },
    { data: settings },
  ] = await Promise.all([
    supabase.from("matches").select("id, played_at").order("played_at", { ascending: true }),
    supabase.from("race_results").select("match_id, player_id, position"),
    supabase.from("players").select("id, name, character_avatar, avatar_url, rating"),
    supabase.from("position_points").select("position, points"),
    supabase.from("scoring_settings").select("season_prior").single(),
  ]);

  if (!settings) throw new Error("scoring_settings row is missing");

  const byMonth = new Map<string, string[]>();
  for (const m of (matchRows ?? []) as MatchRow[]) {
    const ym = toYearMonth(m.played_at);
    const arr = byMonth.get(ym) ?? [];
    arr.push(m.id);
    byMonth.set(ym, arr);
  }

  return {
    results: (resultRows ?? []) as ResultRow[],
    players: (playerRows ?? []) as PlayerRow[],
    points: new Map((pointRows ?? []).map((r: { position: number; points: number }) => [r.position, r.points])),
    seasonPrior: settings.season_prior,
    byMonth,
    sortedMonths: [...byMonth.keys()].sort(),
  };
}

export function seasonStandings(matchIds: string[], data: SeasonData): SeasonStanding[] {
  const matchSet = new Set(matchIds);
  const totals = new Map<string, { points: number; gp: number; p1: number }>();
  for (const r of data.results) {
    if (!matchSet.has(r.match_id)) continue;
    const t = totals.get(r.player_id) ?? { points: 0, gp: 0, p1: 0 };
    t.points += data.points.get(r.position) ?? 0;
    t.gp += 1;
    if (r.position === 1) t.p1 += 1;
    totals.set(r.player_id, t);
  }

  const playerMap = new Map(data.players.map((p) => [p.id, p]));
  return [...totals.entries()]
    .flatMap(([pid, t]): SeasonStanding[] => {
      const player = playerMap.get(pid);
      if (!player) return [];
      return [{ player, ...t, rating: t.points / (data.seasonPrior + t.gp) }];
    })
    .sort((a, b) => compareRank(rankKey(a), rankKey(b)));
}

export function rankKey(s: Pick<SeasonStanding, "player" | "rating" | "p1">) {
  return { rating: s.rating, p1: s.p1, tiebreakRating: s.player.rating, name: s.player.name };
}

export function computeSeasonWins(data: SeasonData, upToExclusive: string): Map<string, number> {
  const seasonWins = new Map<string, number>();
  for (const ym of data.sortedMonths) {
    if (ym >= upToExclusive) break;
    const winner = seasonStandings(data.byMonth.get(ym) ?? [], data)[0];
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
  };
}
