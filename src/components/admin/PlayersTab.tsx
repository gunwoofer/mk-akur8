"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/types";

const AVATARS = ["🏎️", "🍄", "⭐", "🦕", "🐢", "👸", "🦊", "🐸", "🐧", "🦁", "🐉", "🌸"];

export default function PlayersTab() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🏎️");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPlayers() {
    setLoading(true);
    const res = await fetch("/api/players");
    const data = await res.json();
    setPlayers(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchPlayers(); }, []);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), character_avatar: avatar }),
    });
    if (res.ok) {
      setName("");
      await fetchPlayers();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to add player");
    }
    setAdding(false);
  }

  async function deletePlayer(id: string) {
    if (!confirm("Remove this player?")) return;
    await fetch(`/api/players/${id}`, { method: "DELETE" });
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-white font-bold text-xl mb-1">Manage Players</h2>
        <p className="text-gray-500 text-xs">Add or remove office racers.</p>
      </div>

      {/* Add player form */}
      <form onSubmit={addPlayer} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
        <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest">New Player</p>

        <div className="flex gap-2 flex-wrap">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAvatar(a)}
              className={`text-2xl w-10 h-10 rounded-lg transition-all ${
                avatar === a
                  ? "bg-[#00d4ff]/20 ring-2 ring-[#00d4ff]"
                  : "bg-[#242424] hover:bg-[#2a2a2a]"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="flex-1 bg-[#242424] border border-[#333] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00d4ff]"
          />
          <button
            type="submit"
            disabled={adding || !name.trim()}
            className="px-4 py-2 bg-[#00d4ff] text-black font-bold text-sm rounded-lg disabled:opacity-40 transition-opacity"
          >
            {adding ? "…" : "Add"}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </form>

      {/* Players list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : players.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No players yet. Add one above.</p>
        ) : (
          players.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3"
            >
              <span className="text-2xl">{p.character_avatar}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                <p className="text-gray-500 text-xs">{p.gp_played} GPs · Rating {p.rating.toFixed(2)}</p>
              </div>
              <button
                onClick={() => deletePlayer(p.id)}
                className="text-gray-600 hover:text-red-400 transition-colors text-lg p-1"
                aria-label="Delete player"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
