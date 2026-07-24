"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Player, HistoryEntry, SeasonSummary, SeasonPlayer } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";

function TrophyBadge({ wins }: { wins: number }) {
  if (wins === 0) return null;
  if (wins <= 5) return <span className="text-yellow-400 text-xs leading-none">{"🏆".repeat(wins)}</span>;
  return <span className="text-yellow-400 text-xs font-bold leading-none">🏆×{wins}</span>;
}

type SubView = "ranking" | "history" | "seasons";

const PAGE_SIZE = 5;

export default function ResultsTab() {
  const [view, setView] = useState<SubView>("ranking");

  // Ranking + history state
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasonWins, setSeasonWins] = useState<Map<string, number>>(new Map());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  // Seasons state
  const [seasonsList, setSeasonsList] = useState<SeasonSummary[]>([]);
  const [seasonsLoaded, setSeasonsLoaded] = useState(false);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<SeasonSummary | null>(null);
  const [seasonRanking, setSeasonRanking] = useState<SeasonPlayer[] | null>(null);
  const [loadingSeasonDetail, setLoadingSeasonDetail] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [p, h, seasonData] = await Promise.all([
          api.players.list(),
          api.history.list({ limit: PAGE_SIZE, offset: 0 }),
          api.seasons.current(),
        ]);
        setPlayers(p);
        setSeasonWins(new Map(seasonData.ranking.map((r) => [r.player_id, r.season_wins])));
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

  useEffect(() => {
    if (view !== "seasons" || seasonsLoaded) return;
    setLoadingSeasons(true);
    api.seasons.list().then((data) => {
      setSeasonsList(data);
      setSeasonsLoaded(true);
    }).catch(() => {
      setSeasonsLoaded(true);
    }).finally(() => setLoadingSeasons(false));
  }, [view, seasonsLoaded]);

  async function openSeason(season: SeasonSummary) {
    setSelectedSeason(season);
    setSeasonRanking(null);
    setLoadingSeasonDetail(true);
    try {
      const data = await api.seasons.get(season.year_month);
      setSeasonRanking(data.ranking);
    } finally {
      setLoadingSeasonDetail(false);
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const tabLabels: Record<SubView, string> = {
    ranking: "Rankings",
    history: "History",
    seasons: "Seasons",
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[#0a0a0a] px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-xl">Results</h2>
          {view === "seasons" && selectedSeason && (
            <button
              onClick={() => { setSelectedSeason(null); setSeasonRanking(null); }}
              className="text-[#00d4ff] text-sm font-semibold"
            >
              ← All Seasons
            </button>
          )}
        </div>
        <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1">
          {(["ranking", "history", "seasons"] as SubView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                view === v ? "bg-[#00d4ff] text-black" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tabLabels[v]}
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
                <AvatarDisplay avatarUrl={p.avatar_url} characterAvatar={p.character_avatar} imgClassName="w-8 h-8" emojiClassName="text-2xl" />
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{p.name}</p>
                  <p className="text-gray-500 text-xs">{p.gp_played} GPs</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[#00d4ff] font-bold tabular-nums">{p.rating.toFixed(2)}</p>
                  <TrophyBadge wins={seasonWins.get(p.id) ?? 0} />
                </div>
              </div>
            ))}
          </div>
        ) : view === "history" ? (
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
                      {h.results.map((r) => {
                        const tied = h.results.filter((x) => x.position === r.position).length > 1;
                        return (
                          <div key={r.player_id} className="flex items-center gap-3 px-4 py-2">
                            <span className={`font-bold text-sm w-6 ${r.position <= 3 ? "text-yellow-400" : "text-gray-600"}`}>
                              {tied ? `=${r.position}` : `P${r.position}`}
                            </span>
                            <span>{r.avatar}</span>
                            <span className="text-white text-sm">{r.name}</span>
                          </div>
                        );
                      })}
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
        ) : /* seasons view */ selectedSeason ? (
          /* Season detail */
          <div className="space-y-2">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">
              Season {selectedSeason.season_number} — {selectedSeason.gp_count} GPs
            </p>
            {loadingSeasonDetail ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !seasonRanking || seasonRanking.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No results for this season.</p>
            ) : (
              seasonRanking.map((p, i) => (
                <div
                  key={p.player_id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                    i === 0 ? "bg-[rgba(250,200,0,0.06)] border-[#fac800]/30" : "bg-[#1a1a1a] border-[#2a2a2a]"
                  }`}
                >
                  <span className={`font-black text-lg w-6 text-center ${
                    i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-600"
                  }`}>
                    {i + 1}
                  </span>
                  <AvatarDisplay avatarUrl={p.avatar_url} characterAvatar={p.character_avatar} imgClassName="w-8 h-8" emojiClassName="text-2xl" />
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{p.name}</p>
                    <p className="text-gray-500 text-xs">{p.season_gp} GPs</p>
                  </div>
                  <p className="text-[#00d4ff] font-bold tabular-nums">{p.season_rating.toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Seasons list */
          <div className="space-y-2">
            {loadingSeasons ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : seasonsList.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No past seasons yet.</p>
            ) : (
              seasonsList.map((s) => (
                <button
                  key={s.year_month}
                  onClick={() => openSeason(s)}
                  className="w-full flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-left active:border-[#00d4ff]/40 transition-all"
                >
                  <div className="shrink-0 text-center w-10">
                    <p className={`font-black text-base ${s.is_current ? "text-[#00d4ff]" : "text-yellow-400"}`}>S{s.season_number}</p>
                    <p className="text-gray-600 text-xs">{s.gp_count} GP</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm leading-tight">
                      {s.month_name}
                      {s.is_current && <span className="ml-1.5 text-[#00d4ff] text-xs font-normal">current</span>}
                    </p>
                    {s.winner ? (
                      <p className="text-gray-500 text-xs mt-0.5">
                        {s.winner.character_avatar} {s.winner.name}
                      </p>
                    ) : (
                      <p className="text-gray-700 text-xs mt-0.5 italic">No games yet</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {s.top3.map((p) => (
                      <AvatarDisplay
                        key={p.player_id}
                        avatarUrl={p.avatar_url}
                        characterAvatar={p.character_avatar}
                        imgClassName="w-6 h-6"
                        emojiClassName="text-lg leading-none"
                      />
                    ))}
                  </div>
                  <span className="text-gray-600 text-base shrink-0">›</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
