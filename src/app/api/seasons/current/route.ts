import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { getPoints } from "@/lib/points";
import type { SeasonInfo, SeasonPlayer } from "@/types";

interface MatchRow {
  id: string;
  played_at: string;
}

interface ResultRow {
  match_id: string;
  player_id: string;
  position: number;
}

interface PlayerRow {
  id: string;
  name: string;
  character_avatar: string;
  avatar_url: string | null;
  rating: number;
}

function toYearMonth(iso: string) {
  return iso.slice(0, 7); // '2025-07'
}

function monthName(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "long" });
}

function daysInMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function daysLeft(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const now = new Date();
  const end = new Date(year, month, 0); // last day of month
  const diff = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

const BAYESIAN_PRIOR = 20;

function computeRatings(
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

function computeWinner(
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

export async function GET() {
  const supabase = getServerSupabase();

  const [{ data: matchRows }, { data: resultRows }, { data: playerRows }] = await Promise.all([
    supabase.from("matches").select("id, played_at").order("played_at", { ascending: true }),
    supabase.from("race_results").select("match_id, player_id, position"),
    supabase.from("players").select("id, name, character_avatar, avatar_url, rating"),
  ]);

  const matches = (matchRows ?? []) as MatchRow[];
  const results = (resultRows ?? []) as ResultRow[];
  const players = (playerRows ?? []) as PlayerRow[];

  // Group match IDs by year_month
  const byMonth = new Map<string, string[]>();
  for (const m of matches) {
    const ym = toYearMonth(m.played_at);
    const arr = byMonth.get(ym) ?? [];
    arr.push(m.id);
    byMonth.set(ym, arr);
  }

  const sortedMonths = [...byMonth.keys()].sort();
  const nowYM = toYearMonth(new Date().toISOString());
  const currentSeasonNumber = sortedMonths.indexOf(nowYM) + 1; // 0 if not in list yet
  const hasGames = byMonth.has(nowYM);

  // If no games ever played, return empty state
  if (sortedMonths.length === 0) {
    const season_info: SeasonInfo = {
      season_number: 1,
      year_month: nowYM,
      month_name: monthName(nowYM),
      days_left: daysLeft(nowYM),
      days_total: daysInMonth(nowYM),
      has_games: false,
    };
    return NextResponse.json({ season_info, ranking: [] });
  }

  // Season number for current month: if games exist this month use its index+1,
  // otherwise it will be len(sortedMonths)+1 (next upcoming season)
  const seasonNumber = hasGames ? currentSeasonNumber : sortedMonths.length + 1;

  const season_info: SeasonInfo = {
    season_number: seasonNumber,
    year_month: nowYM,
    month_name: monthName(nowYM),
    days_left: daysLeft(nowYM),
    days_total: daysInMonth(nowYM),
    has_games: hasGames,
  };

  // Compute season_wins per player from all past (completed) months
  const seasonWins = new Map<string, number>();
  const pastMonths = sortedMonths.filter((ym) => ym < nowYM);
  for (const ym of pastMonths) {
    const mids = byMonth.get(ym) ?? [];
    const winner = computeWinner(mids, results, players);
    if (winner) seasonWins.set(winner, (seasonWins.get(winner) ?? 0) + 1);
  }

  // Compute current season ranking
  const currentMatchIds = byMonth.get(nowYM) ?? [];
  const currentRatings = computeRatings(currentMatchIds, results);

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const ranking: SeasonPlayer[] = [...currentRatings.entries()]
    .flatMap(([pid, { points, gp }]): SeasonPlayer[] => {
      const p = playerMap.get(pid);
      if (!p) return [];
      return [{
        player_id: pid,
        name: p.name,
        character_avatar: p.character_avatar,
        avatar_url: p.avatar_url ?? null,
        season_rating: points / (BAYESIAN_PRIOR + gp),
        season_gp: gp,
        season_wins: seasonWins.get(pid) ?? 0,
      }];
    })
    .sort((a, b) => b.season_rating - a.season_rating || a.name.localeCompare(b.name));

  // Include players with 0 season GPs but season wins (for trophy display)
  for (const p of players) {
    if (!currentRatings.has(p.id) && (seasonWins.get(p.id) ?? 0) > 0) {
      ranking.push({
        player_id: p.id,
        name: p.name,
        character_avatar: p.character_avatar,
        avatar_url: p.avatar_url,
        season_rating: 0,
        season_gp: 0,
        season_wins: seasonWins.get(p.id) ?? 0,
      });
    }
  }

  return NextResponse.json({ season_info, ranking });
}
