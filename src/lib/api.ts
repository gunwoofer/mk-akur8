import type { Player, PlayerStats, HistoryEntry, SeasonInfo, SeasonPlayer, BestStreak } from "@/types";

export type SubmitResult = { player_id: string; position: number };

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
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
    create: (name: string, character_avatar: string) =>
      apiFetch<Player>("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, character_avatar }),
      }),
    delete: (id: string) =>
      apiFetch<{ deleted: string }>(`/api/players/${id}`, { method: "DELETE" }),
    stats: (id: string) =>
      apiFetch<PlayerStats>(`/api/players/${id}`),
    updateAvatar: (id: string, avatarUrl: string | null) =>
      apiFetch<Player>(`/api/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      }),
  },
  matches: {
    submit: (results: SubmitResult[]) =>
      apiFetch<{ match_id: string }>("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      }),
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
      apiFetch<{ player_id: string | null; streak: number; best_ever: BestStreak | null } | null>("/api/streak"),
  },
  seasons: {
    current: () =>
      apiFetch<{ season_info: SeasonInfo; ranking: SeasonPlayer[] }>("/api/seasons/current"),
  },
  seed: {
    run: () =>
      apiFetch<{ message: string }>("/api/seed", { method: "POST" }),
  },
};
