export interface PointsRow {
  pos: string;
  pts: number;
}

// Canonical GP points table — single source of truth for both the UI and seed data.
// The authoritative scoring lives in the `position_points` DB table; this mirrors it
// for client-side display (RankingInfoModal) without an extra round-trip.
export const POINTS_TABLE: PointsRow[] = [
  { pos: "1st",      pts: 15 }, { pos: "2nd",      pts: 12 },
  { pos: "3rd",      pts: 10 }, { pos: "4th",      pts:  9 },
  { pos: "5th",      pts:  8 }, { pos: "6th",      pts:  7 },
  { pos: "7th",      pts:  6 }, { pos: "8th",      pts:  5 },
  { pos: "9th",      pts:  4 }, { pos: "10th",     pts:  3 },
  { pos: "11th",     pts:  2 }, { pos: "12th",     pts:  1 },
  { pos: "13th–24th", pts:  0 },
];

export function getPoints(position: number): number {
  if (position <= 12) return POINTS_TABLE[position - 1].pts;
  return 0;
}
