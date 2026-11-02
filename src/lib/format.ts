import type { SeasonKind } from "@/types";

// Elo seasons are whole numbers (1516); older average-based seasons keep two decimals (11.85).
export function formatSeasonRating(value: number, kind: SeasonKind): string {
  return kind === "elo" ? String(Math.round(value)) : value.toFixed(2);
}

export function formatSeasonDelta(delta: number, kind: SeasonKind): string {
  const abs = kind === "elo" ? String(Math.round(Math.abs(delta))) : Math.abs(delta).toFixed(2);
  return `${delta >= 0 ? "+" : "−"}${abs}`;
}

export function formatPlayerRating(p: { rating: number; rating_kind?: SeasonKind }): string {
  return formatSeasonRating(p.rating, p.rating_kind ?? "average");
}

export function ratingUnit(kind: SeasonKind | undefined): string {
  return kind === "elo" ? "Elo" : "pts";
}

// Below this a change rounds to nothing in the format above.
export function deltaThreshold(kind: SeasonKind): number {
  return kind === "elo" ? 0.5 : 0.005;
}
