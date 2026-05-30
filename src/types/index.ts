export interface Player {
  id: string;
  name: string;
  character_avatar: string;
  rating: number;
  gp_played: number;
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
  played_at: string | null;
  position: number;
}

export interface PlayerStats {
  player: Player;
  podiums: number;
  worst_finish: number;
  avg_placement: number;
  recent_results: RecentResult[];
}

export interface HistoryResult {
  player_id: string;
  position: number;
  name: string;
  avatar: string;
}

export interface HistoryEntry {
  match_id: string;
  played_at: string;
  results: HistoryResult[];
}

export interface SubmitMatchPayload {
  results: { player_id: string; position: number }[];
}
