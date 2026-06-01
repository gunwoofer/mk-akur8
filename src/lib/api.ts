import type { Player, PlayerStats, HistoryEntry } from "@/types";

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
  seed: {
    run: () =>
      apiFetch<{ message: string }>("/api/seed", { method: "POST" }),
  },
};
