import type { GPBreakdown, GPDetail, Player, PlayerStats, PlayerTrackStats, HistoryEntry, RaceSubmission, ScoringConfig, Track, TracksOverview, SeasonInfo, SeasonPlayer, SeasonSummary, StreakResponse } from "@/types";

export type SubmitResult = { player_id: string; position: number };

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  // The admin session expired or was never opened: back to the code screen.
  if (res.status === 401 && typeof window !== "undefined" && url !== "/api/auth/login") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  players: {
    list: () =>
      apiFetch<Player[]>("/api/players"),
    archived: () =>
      apiFetch<Player[]>("/api/players?archived=1"),
    create: (name: string, character_avatar: string) =>
      apiFetch<Player>("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, character_avatar }),
      }),
    delete: (id: string) =>
      apiFetch<{ deleted: string } | { archived: string }>(`/api/players/${id}`, { method: "DELETE" }),
    restore: (id: string) =>
      apiFetch<Player>(`/api/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      }),
    stats: (id: string) =>
      apiFetch<PlayerStats>(`/api/players/${id}`),
    trackStats: (id: string) =>
      apiFetch<PlayerTrackStats>(`/api/players/${id}/tracks`),
    uploadAvatar: (id: string, photo: Blob) =>
      apiFetch<Player>(`/api/players/${id}/avatar`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: photo,
      }),
    updateAvatar: (id: string, avatarUrl: string | null) =>
      apiFetch<Player>(`/api/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      }),
  },
  matches: {
    submit: (results: SubmitResult[], races?: RaceSubmission[]) =>
      apiFetch<{ match_id: string }>("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results, races }),
      }),
    get: (id: string) =>
      apiFetch<GPDetail>(`/api/matches/${id}`),
    delete: (id: string) =>
      apiFetch<{ deleted: string }>(`/api/matches/${id}`, { method: "DELETE" }),
  },
  history: {
    list: (params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.offset !== undefined) qs.set("offset", String(params.offset));
      const query = qs.toString();
      return apiFetch<HistoryEntry[]>(`/api/history${query ? `?${query}` : ""}`);
    },
  },
  streak: {
    get: () =>
      apiFetch<StreakResponse | null>("/api/streak"),
  },
  seasons: {
    current: () =>
      apiFetch<{ season_info: SeasonInfo; ranking: SeasonPlayer[]; season_wins: Record<string, number> }>("/api/seasons/current"),
    list: () =>
      apiFetch<SeasonSummary[]>("/api/seasons"),
    get: (yearMonth: string) =>
      apiFetch<{ ranking: SeasonPlayer[] }>(`/api/seasons/${yearMonth}`),
  },
  tracks: {
    list: () =>
      apiFetch<Track[]>("/api/tracks"),
    overview: () =>
      apiFetch<TracksOverview>("/api/tracks/overview"),
  },
  gp: {
    breakdown: (offset = 0) =>
      apiFetch<GPBreakdown | null>(`/api/gp-breakdown?offset=${offset}`),
  },
  auth: {
    login: (code: string) =>
      apiFetch<{ ok: true }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),
  },
  scoring: {
    get: () =>
      apiFetch<ScoringConfig>("/api/scoring"),
  },
};
