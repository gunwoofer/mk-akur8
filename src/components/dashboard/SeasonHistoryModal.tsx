"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { SeasonSummary, SeasonPlayer } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";

function medalColor(rank: number) {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-gray-300";
  if (rank === 3) return "text-amber-600";
  return "text-gray-500";
}

interface Props {
  onClose: () => void;
}

export default function SeasonHistoryModal({ onClose }: Props) {
  const [seasons, setSeasons] = useState<SeasonSummary[] | null>(null);
  const [selected, setSelected] = useState<SeasonSummary | null>(null);
  const [ranking, setRanking] = useState<SeasonPlayer[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    api.seasons.list().then((data) => {
      setSeasons(data);
      setLoadingList(false);
    }).catch(() => setLoadingList(false));
  }, []);

  async function openSeason(season: SeasonSummary) {
    setSelected(season);
    setRanking(null);
    setLoadingDetail(true);
    try {
      const data = await api.seasons.get(season.year_month);
      setRanking(data.ranking);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />

      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-3">
            {selected && (
              <button
                onClick={() => { setSelected(null); setRanking(null); }}
                className="text-[#00d4ff] text-sm font-semibold hover:text-white transition-colors"
              >
                ← Back
              </button>
            )}
            <h2 className="text-white font-black text-xl italic tracking-tight">
              {selected
                ? `${selected.month_name} — Season ${selected.season_number}`
                : "Season History"}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-xl transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {!selected ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-4 space-y-2"
              >
                {loadingList ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : !seasons || seasons.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-12">No past seasons yet.</p>
                ) : (
                  seasons.map((s) => (
                    <button
                      key={s.year_month}
                      onClick={() => openSeason(s)}
                      className="w-full flex items-center gap-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-left hover:border-[#00d4ff]/40 transition-all group"
                    >
                      {/* Season badge */}
                      <div className="shrink-0 text-center w-12">
                        <p className={`font-black text-lg ${s.is_current ? "text-[#00d4ff]" : "text-yellow-400"}`}>S{s.season_number}</p>
                        <p className="text-gray-600 text-xs tabular-nums">{s.gp_count} GPs</p>
                      </div>

                      {/* Month name + winner */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm leading-tight">
                          {s.month_name}
                          {s.is_current && <span className="ml-2 text-[#00d4ff] text-xs font-normal">current</span>}
                        </p>
                        {s.winner ? (
                          <p className="text-gray-500 text-xs mt-0.5">
                            Winner: {s.winner.character_avatar} {s.winner.name}
                          </p>
                        ) : (
                          <p className="text-gray-700 text-xs mt-0.5 italic">No games yet</p>
                        )}
                      </div>

                      {/* Top 3 avatars */}
                      <div className="flex items-center gap-1 shrink-0">
                        {s.top3.map((p, i) => (
                          <div key={p.player_id} className="relative">
                            <AvatarDisplay
                              avatarUrl={p.avatar_url}
                              characterAvatar={p.character_avatar}
                              imgClassName="w-8 h-8"
                              emojiClassName="text-2xl leading-none"
                            />
                            {i === 0 && <span className="absolute -top-1 -right-1 text-[10px] leading-none">🥇</span>}
                            {i === 1 && <span className="absolute -top-1 -right-1 text-[10px] leading-none">🥈</span>}
                            {i === 2 && <span className="absolute -top-1 -right-1 text-[10px] leading-none">🥉</span>}
                          </div>
                        ))}
                      </div>

                      <span className="text-gray-700 group-hover:text-[#00d4ff] transition-colors text-lg shrink-0">›</span>
                    </button>
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="p-4"
              >
                {loadingDetail ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : !ranking || ranking.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-12">No results for this season.</p>
                ) : (
                  <div className="space-y-1.5">
                    {ranking.map((p, i) => {
                      const rank = i + 1;
                      return (
                        <div
                          key={p.player_id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                            rank === 1 ? "border-[#fac800]/40 bg-[rgba(250,200,0,0.06)]" : "border-[#2a2a2a] bg-[#1a1a1a]"
                          }`}
                        >
                          <span className={`font-black text-xl italic w-7 text-center shrink-0 ${medalColor(rank)}`}>{rank}</span>
                          <AvatarDisplay
                            avatarUrl={p.avatar_url}
                            characterAvatar={p.character_avatar}
                            imgClassName="w-9 h-9"
                            emojiClassName="text-3xl"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-base italic truncate">{p.name.toUpperCase()}</p>
                            <p className="text-gray-600 text-xs">{p.season_gp} GPs</p>
                          </div>
                          <p className="text-[#00d4ff] font-black text-xl italic tabular-nums">
                            {p.season_rating.toFixed(2)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
