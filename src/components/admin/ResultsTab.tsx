"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/types";

type SubView = "ranking" | "history";

interface HistoryEntry {
  match_id: string;
  played_at: string;
  results: { player_id: string; position: number; name: string; avatar: string }[];
}

export default function ResultsTab() {
  const [view, setView] = useState<SubView>("ranking");
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [pRes, hRes] = await Promise.all([
        fetch("/api/players"),
        fetch("/api/history"),
      ]);
      if (pRes.ok) setPlayers(await pRes.json());
      if (hRes.ok) setHistory(await hRes.json());
      setLoading(false);
    }
    load();
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-white font-bold text-xl mb-1">Results</h2>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1">
        {(["ranking", "history"] as SubView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
              view === v
                ? "bg-[#00d4ff] text-black"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {v === "ranking" ? "Rankings" : "History"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === "ranking" ? (
        <div className="space-y-2">
          {players.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3"
            >
              <span className={`font-black text-lg w-6 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-600"}`}>
                {i + 1}
              </span>
              <span className="text-2xl">{p.character_avatar}</span>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{p.name}</p>
                <p className="text-gray-500 text-xs">{p.gp_played} GPs</p>
              </div>
              <p className="text-[#00d4ff] font-bold tabular-nums">{p.rating.toFixed(2)}</p>
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-8">No players yet.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {history.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-8">No matches played yet.</p>
          )}
          {history.map((h) => (
            <div key={h.match_id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-[#2a2a2a] flex items-center justify-between">
                <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest">Grand Prix</p>
                <p className="text-gray-500 text-xs">{formatDate(h.played_at)}</p>
              </div>
              <div className="divide-y divide-[#2a2a2a]">
                {h.results.map((r) => (
                  <div key={r.player_id} className="flex items-center gap-3 px-4 py-2">
                    <span className={`font-bold text-sm w-5 ${r.position <= 3 ? "text-yellow-400" : "text-gray-600"}`}>
                      P{r.position}
                    </span>
                    <span>{r.avatar}</span>
                    <span className="text-white text-sm">{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
