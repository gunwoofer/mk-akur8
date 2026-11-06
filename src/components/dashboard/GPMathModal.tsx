"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import AvatarDisplay from "@/components/AvatarDisplay";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { GPBreakdown, GPBreakdownPlayer } from "@/types";

type Scope = "season" | "global";

// One decimal everywhere in this modal so the lines visibly add up.
function signed(x: number, digits = 1): string {
  const v = Math.abs(x).toFixed(digits);
  return Number(v) === 0 ? `±${v}` : `${x > 0 ? "+" : "−"}${v}`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Montreal", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function GPMathModal({ initialScope, onClose }: { initialScope: Scope; onClose: () => void }) {
  const mobile = useIsMobile();
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<GPBreakdown | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [scopePick, setScope] = useState<Scope>(initialScope);

  useEffect(() => {
    let live = true;
    api.gp.breakdown(offset)
      .then((d) => { if (live) { setData(d); setFailed(false); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [offset]);

  const scope: Scope = data && !data[scopePick] && data[scopePick === "season" ? "global" : "season"]
    ? (scopePick === "season" ? "global" : "season") : scopePick;
  const view = data?.[scope] ?? null;
  const example = view?.players[0]?.duels[0] ? { a: view.players[0], d: view.players[0].duels[0] } : null;

  const navButton = "w-9 h-9 rounded-full flex items-center justify-center border border-white/10 bg-black/40 text-white disabled:opacity-25";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`fixed inset-0 z-50 flex items-center justify-center ${mobile ? "p-3" : "p-8"}`}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ scale: 0.94, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl flex flex-col overflow-hidden rounded-2xl border border-white/10 max-h-[92vh]"
        style={{ background: "linear-gradient(180deg, #17171f 0%, #101016 60%)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
      >
        <div className="checkered h-2 w-full shrink-0 opacity-80" />
        <div className="h-1 w-full shrink-0" style={{ background: "#e60012" }} />

        {/* Header */}
        <div className={`flex items-center justify-between shrink-0 ${mobile ? "px-4 pt-4 pb-3" : "px-7 pt-6 pb-4"}`}>
          <div className="min-w-0">
            <h2 className={`font-racing mk-title leading-none ${mobile ? "text-3xl" : "text-4xl"}`}>GP Math</h2>
            <p className="text-[#9ca3af] text-xs mt-1 truncate">
              {data ? `${offset === 0 ? "Latest GP" : `${offset} GP${offset > 1 ? "s" : ""} before the latest`} · ${when(data.played_at)}` : " "}
            </p>
          </div>
          <div className="flex items-center shrink-0 ml-3">
            <button
              onClick={() => setOffset((o) => o + 1)}
              disabled={!data || offset + 1 >= data.total}
              aria-label="Older GP"
              className={`${navButton} mr-1.5`}
            >‹</button>
            <button
              onClick={() => setOffset((o) => Math.max(0, o - 1))}
              disabled={offset === 0}
              aria-label="Newer GP"
              className={`${navButton} mr-3`}
            >›</button>
            <button onClick={onClose} aria-label="Close" className={navButton}>✕</button>
          </div>
        </div>

        <div className={`overflow-y-auto flex-1 min-h-0 ${mobile ? "px-4 pb-4" : "px-7 pb-6"}`}>
          {failed ? (
            <p className="text-[#f87171] text-sm py-8 text-center">Couldn&apos;t load this GP.</p>
          ) : data === undefined ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#ffd400] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : data === null ? (
            <p className="text-[#9ca3af] text-sm py-10 text-center">No GP played yet.</p>
          ) : !view ? (
            <p className="text-[#9ca3af] text-sm py-10 text-center">This GP was scored with the old points formula, before Elo.</p>
          ) : (
            <>
              {/* Season / Global */}
              <div className={`flex mb-4 ${mobile ? "flex-col items-start" : "items-center"}`}>
                <div className="flex bg-black/60 border border-white/10 rounded-xl p-1 shrink-0">
                  {(["season", "global"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScope(s)}
                      disabled={!data[s]}
                      className={`font-racing px-4 py-1 rounded-lg text-xs uppercase ${s === "global" ? "ml-1" : ""} ${
                        scope === s ? "bg-[#e60012] text-white" : "text-[#9ca3af] disabled:opacity-30"
                      }`}
                    >
                      {s === "season" ? "Season Elo" : "Global Elo"}
                    </button>
                  ))}
                </div>
                <p className={`text-[#cbd5e1] text-xs leading-snug ${mobile ? "mt-2" : "ml-4"}`}>
                  Every pair of players is a duel. Each duel is worth{" "}
                  <span className="text-white font-semibold whitespace-nowrap">{data.k} ÷ opponents × (result − expected)</span>.
                  Bots don&apos;t count.
                </p>
              </div>

              {!view.exact && (
                <p className="text-[#fbbf24] text-xs mb-3">
                  ⚠️ This GP was scored with different settings than today&apos;s, so the lines below may not add up exactly.
                </p>
              )}

              <div className={`grid gap-3 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
                {view.players.map((p) => <PlayerCard key={p.player_id} p={p} k={data.k} />)}
              </div>

              {/* How "expected" works */}
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[#9ca3af] text-[11px] uppercase tracking-widest mb-1.5">Where “expected” comes from</p>
                <p className="text-[#e5e7eb] text-sm">
                  expected = 1 ÷ (1 + 10<sup>(their Elo − your Elo) ÷ {data.scale}</sup>)
                </p>
                <p className="text-[#9ca3af] text-xs mt-1 leading-relaxed">
                  Same Elo = 50%. Being 100 above = 64%, 200 above = 76%, {data.scale} above = 91%.
                  Beat someone you were expected to lose to and you win big; beat someone you were expected to beat and you win a little.
                </p>
                {example && (
                  <p className="text-[#9ca3af] text-xs mt-2 leading-relaxed">
                    <span className="text-[#cbd5e1]">Example:</span> {example.a.name} ({example.a.before.toFixed(1)}) vs {example.d.name} ({example.d.their_rating.toFixed(1)})
                    {" → "}1 ÷ (1 + 10<sup>{signed(example.d.their_rating - example.a.before)} ÷ {data.scale}</sup>)
                    {" = "}<span className="text-white font-semibold">{Math.round(example.d.expected * 100)}%</span> for {example.a.name}.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function PlayerCard({ p, k }: { p: GPBreakdownPlayer; k: number }) {
  const delta = p.after - p.before;
  const surplus = p.duels.reduce((s, d) => s + d.result - d.expected, 0);
  const up = delta >= 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
      <div className="flex items-center px-3 py-2.5 border-b border-white/10">
        <span className="font-racing text-[#ffd400] text-lg w-10 shrink-0">P{p.position}</span>
        <AvatarDisplay avatarUrl={p.avatar_url} characterAvatar={p.character_avatar} imgClassName="w-8 h-8 mr-2" emojiClassName="text-2xl mr-2" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{p.name}</p>
          <p className="text-[#9ca3af] text-xs tabular-nums">{p.before.toFixed(1)} → {p.after.toFixed(1)}</p>
        </div>
        <span className={`font-racing text-xl tabular-nums shrink-0 ${up ? "text-[#4ade80]" : "text-[#f87171]"}`}>
          {signed(delta)}
        </span>
      </div>

      <div className="px-3 py-1.5">
        {p.duels.map((d) => (
          <div key={d.opponent_id} className="flex items-center py-1 text-xs tabular-nums">
            <span className="flex-1 min-w-0 truncate text-[#cbd5e1]">
              vs <span className="text-white font-semibold">{d.name}</span> <span className="text-[#6b7280]">{Math.round(d.their_rating)}</span>
            </span>
            <span className={`w-12 text-right shrink-0 font-semibold ${d.result === 1 ? "text-[#4ade80]" : d.result === 0 ? "text-[#f87171]" : "text-[#cbd5e1]"}`}>
              {d.result === 1 ? "ahead" : d.result === 0 ? "behind" : "tie"}
            </span>
            <span className="w-20 text-right shrink-0 text-[#9ca3af]">exp. {Math.round(d.expected * 100)}%</span>
            <span className={`w-12 text-right shrink-0 font-semibold ${d.points >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
              {signed(d.points)}
            </span>
          </div>
        ))}
        {p.duels.length === 0 ? (
          <p className="text-[#9ca3af] text-xs py-1">Raced alone with bots: no duel, no change.</p>
        ) : (
          <p className="text-[#6b7280] text-[11px] pt-1 mt-1 border-t border-white/5 tabular-nums">
            {k} ÷ {p.duels.length} × ({signed(surplus, 2)}) = <span className="text-[#cbd5e1] font-semibold">{signed(delta)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
