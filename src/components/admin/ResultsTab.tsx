"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Player, HistoryEntry } from "@/types";

type SubView = "ranking" | "history";

const PAGE_SIZE = 5;

export default function ResultsTab() {
  const [view, setView] = useState<SubView>("ranking");
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [p, h] = await Promise.all([
          api.players.list(),
          api.history.list({ limit: PAGE_SIZE, offset: 0 }),
        ]);
        setPlayers(p);
        setHistory(h);
        setHistoryOffset(h.length);
        setHasMore(h.length === PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const loadMore = useCallback(async (currentOffset: number) => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const more = await api.history.list({ limit: PAGE_SIZE, offset: currentOffset });
      setHistory((prev) => [...prev, ...more]);
      setHistoryOffset(currentOffset + more.length);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  // Keep a ref to current offset so the observer callback always has the latest value
  const historyOffsetRef = useRef(historyOffset);
  useEffect(() => { historyOffsetRef.current = historyOffset; }, [historyOffset]);

  const hasMoreRef = useRef(hasMore);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  useEffect(() => {
    if (view !== "history") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current) {
          loadMore(historyOffsetRef.current);
        }
      },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [view, loadMore]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[#0a0a0a] px-4 pt-4 pb-3 space-y-3">
        <h2 className="text-white font-bold text-xl">Results</h2>
        <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1">
          {(["ranking", "history"] as SubView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                view === v ? "bg-[#00d4ff] text-black" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {v === "ranking" ? "Rankings" : "History"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-red-400 text-sm text-center py-12">{error}</p>
        ) : view === "ranking" ? (
          <div className="space-y-2">
            {players.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No players yet.</p>
            ) : players.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3"
              >
                <span className={`font-black text-lg w-6 text-center ${
                  i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-600"
                }`}>
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
          </div>
        ) : (
          <div className="space-y-4">
            {history.length === 0 && !hasMore ? (
              <p className="text-gray-600 text-sm text-center py-8">No matches played yet.</p>
            ) : (
              <>
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
                <div ref={sentinelRef} className="py-4 flex justify-center">
                  {loadingMore ? (
                    <div className="w-5 h-5 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
                  ) : !hasMore ? (
                    <p className="text-gray-700 text-xs">All matches loaded</p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
