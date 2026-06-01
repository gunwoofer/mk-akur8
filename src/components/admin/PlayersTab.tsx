"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { Player } from "@/types";

const AVATARS = ["🏎️", "🍄", "⭐", "🦕", "🐢", "👸", "🦊", "🐸", "🐧", "🦁", "🐉", "🌸"];

export default function PlayersTab() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🏎️");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPlayers() {
    setLoading(true);
    setFetchError(null);
    try {
      setPlayers(await api.players.list());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load players");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPlayers(); }, []);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await api.players.create(name.trim(), avatar);
      setName("");
      await fetchPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add player");
    } finally {
      setAdding(false);
    }
  }

  async function deletePlayer(id: string) {
    if (!confirm("Remove this player?")) return;
    try {
      await api.players.delete(id);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // non-critical
    }
  }

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Add form */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">New Player</p>
        <form onSubmit={addPlayer} className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-6 gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                className={`aspect-square rounded-xl text-xl flex items-center justify-center transition-all ${
                  avatar === a
                    ? "bg-[#00d4ff]/15 ring-1 ring-[#00d4ff]/60 scale-110"
                    : "bg-[#1e1e1e] hover:bg-[#252525]"
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <label className="flex items-center gap-2 flex-1 bg-[#1a1a1a] border border-[#252525] rounded-xl px-3 focus-within:border-[#00d4ff]/40 transition-colors">
              <span className="text-lg shrink-0">{avatar}</span>
              <input
                type="text"
                placeholder="Player name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="flex-1 bg-transparent py-2.5 text-white text-sm placeholder-gray-700 focus:outline-none"
              />
            </label>
            <motion.button
              type="submit"
              disabled={adding || !name.trim()}
              whileTap={{ scale: 0.97 }}
              className="px-4 py-2.5 bg-[#00d4ff] text-black font-bold text-sm rounded-xl disabled:opacity-30 transition-opacity shrink-0"
            >
              {adding ? "…" : "Add"}
            </motion.button>
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-400 text-xs"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </form>
      </div>

      {/* Roster */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Roster · {players.length} player{players.length !== 1 ? "s" : ""}
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fetchError ? (
          <p className="text-red-400 text-sm text-center py-8">{fetchError}</p>
        ) : players.length === 0 ? (
          <p className="text-gray-700 text-sm text-center py-8">No players yet.</p>
        ) : (
          <AnimatePresence initial={false}>
            {players.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16, height: 0 }}
                transition={{ delay: i * 0.03, duration: 0.18 }}
                className="flex items-center gap-3 bg-[#141414] border border-[#1e1e1e] rounded-2xl px-4 py-3"
              >
                <span className="text-2xl shrink-0">{p.character_avatar}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-gray-600 text-xs">{p.gp_played} GPs · {p.rating.toFixed(2)} pts</p>
                </div>
                <button
                  onClick={() => deletePlayer(p.id)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
