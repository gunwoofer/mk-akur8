export interface RankKey {
  rating: number;
  p1: number;
  tiebreakRating?: number;
  name: string;
}

// Single ordering rule for every leaderboard: rating, then P1 finishes,
// then (for seasons) global rating, then name so the order is stable.
export function compareRank(a: RankKey, b: RankKey): number {
  return (
    b.rating - a.rating ||
    b.p1 - a.p1 ||
    (b.tiebreakRating ?? 0) - (a.tiebreakRating ?? 0) ||
    a.name.localeCompare(b.name)
  );
}
