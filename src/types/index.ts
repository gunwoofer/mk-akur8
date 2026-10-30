export interface Player {
  id: string;
  name: string;
  character_avatar: string;
  avatar_url?: string | null;
  rating: number;
  gp_played: number;
  p1_count?: number;
  archived_at?: string | null;
}

export interface Match {
  id: string;
  played_at: string;
}

export interface RaceResult {
  id: string;
  match_id: string;
  player_id: string;
  position: number;
  player?: Player;
  match?: Match;
}

export interface RecentResult {
  match_id: string;
  played_at: string;
  position: number;
}

export interface StatBlock {
  rating: number;
  rating_delta: number | null;   // change caused by the player's last GP in this scope
  rank: number | null;
  ranked_players: number;
  gp: number;
  wins: number;
  podiums: number;
  avg_finish: number | null;
  best_finish: number | null;
  recent: RecentResult[];         // newest first, max 10
}

export interface SeasonPoint {
  played_at: string;
  rating: number;
  position: number;
}

export interface SeasonRecord {
  year_month: string;
  month_name: string;
  rating: number;
  gp: number;
  rank: number;
  won: boolean;
  is_current: boolean;
}

export interface PlayerStats {
  player: Player;
  season_wins: number;
  current_season: { year_month: string; month_name: string; stats: StatBlock; series: SeasonPoint[] };
  global: StatBlock;
  seasons: SeasonRecord[];        // oldest first, seasons the player took part in
}

export interface HistoryResult {
  player_id: string;
  position: number;
  name: string;
  avatar: string;
  avatar_url?: string | null;
}

export interface HistoryEntry {
  match_id: string;
  played_at: string;
  results: HistoryResult[];
}

export interface SubmitMatchPayload {
  results: { player_id: string; position: number }[];
}

export interface SeasonInfo {
  season_number: number;
  year_month: string;
  month_name: string;
  days_left: number;
  days_total: number;
  has_games: boolean;
}

export interface SeasonPlayer {
  player_id: string;
  name: string;
  character_avatar: string;
  avatar_url?: string | null;
  season_rating: number;
  season_gp: number;
  season_wins: number;
}

export interface BestStreak {
  player_id: string;
  player_name: string;
  streak: number;
}

export interface StreakResponse {
  streaks: Record<string, number>;
  best_ever: BestStreak | null;
}

export interface SeasonSummary {
  season_number: number;
  year_month: string;
  month_name: string;
  gp_count: number;
  is_current: boolean;
  winner: {
    player_id: string;
    name: string;
    character_avatar: string;
    avatar_url: string | null;
  } | null;
  top3: Array<{
    player_id: string;
    name: string;
    character_avatar: string;
    avatar_url: string | null;
    season_rating: number;
  }>;
}

export interface ScoringConfig {
  points: { position: number; points: number }[];
  global_prior: number;
  season_prior: number;
}
