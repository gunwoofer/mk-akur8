import { getPoints } from "@/lib/points";

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

export const BAYESIAN_PRIOR = 20;

export function toYearMonth(iso: string): string {
  return iso.slice(0, 7);
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
  const [year, month] = yearMonth.split("-").map(Number);
  const now = new Date();
  const end = new Date(year, month, 0);
  const diff = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

export function computeRatings(
  matchIds: string[],
  results: ResultRow[]
): Map<string, { points: number; gp: number }> {
  const map = new Map<string, { points: number; gp: number }>();
  const matchSet = new Set(matchIds);
  for (const r of results) {
    if (!matchSet.has(r.match_id)) continue;
    const entry = map.get(r.player_id) ?? { points: 0, gp: 0 };
    entry.points += getPoints(r.position);
    entry.gp += 1;
    map.set(r.player_id, entry);
  }
  return map;
}

export function computeWinner(
  matchIds: string[],
  results: ResultRow[],
  players: PlayerRow[]
): string | null {
  const ratings = computeRatings(matchIds, results);
  if (ratings.size === 0) return null;

  const matchSet = new Set(matchIds);
  const p1Counts = new Map<string, number>();
  for (const r of results) {
    if (!matchSet.has(r.match_id)) continue;
    if (r.position === 1) p1Counts.set(r.player_id, (p1Counts.get(r.player_id) ?? 0) + 1);
  }

  const playerMap = new Map(players.map((p) => [p.id, p]));
  let winner: string | null = null;
  let bestRating = -1;

  for (const [pid, { points, gp }] of ratings) {
    const rating = points / (BAYESIAN_PRIOR + gp);
    if (
      rating > bestRating ||
      (rating === bestRating &&
        ((p1Counts.get(pid) ?? 0) > (p1Counts.get(winner!) ?? 0) ||
          ((p1Counts.get(pid) ?? 0) === (p1Counts.get(winner!) ?? 0) &&
            (playerMap.get(pid)?.rating ?? 0) > (playerMap.get(winner!)?.rating ?? 0))))
    ) {
      bestRating = rating;
      winner = pid;
    }
  }

  return winner;
}

export function computeSeasonWins(
  sortedMonths: string[],
  byMonth: Map<string, string[]>,
  results: ResultRow[],
  players: PlayerRow[],
  upToExclusive: string
): Map<string, number> {
  const seasonWins = new Map<string, number>();
  for (const ym of sortedMonths) {
    if (ym >= upToExclusive) break;
    const mids = byMonth.get(ym) ?? [];
    const winner = computeWinner(mids, results, players);
    if (winner) seasonWins.set(winner, (seasonWins.get(winner) ?? 0) + 1);
  }
  return seasonWins;
}
