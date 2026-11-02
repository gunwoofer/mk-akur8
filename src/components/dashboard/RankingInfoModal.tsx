"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { ScoringConfig } from "@/types";

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

// Collapse the trailing run of zero-point positions into one "13th–24th" cell.
function pointsCells(points: ScoringConfig["points"]): { pos: string; pts: number }[] {
  const lastScoring = points.reduce((last, r) => (r.points > 0 ? r.position : last), 0);
  const cells = points
    .filter((r) => r.position <= lastScoring)
    .map((r) => ({ pos: ordinal(r.position), pts: r.points }));
  const zeros = points.filter((r) => r.position > lastScoring);
  if (zeros.length === 1) cells.push({ pos: ordinal(zeros[0].position), pts: 0 });
  if (zeros.length > 1) cells.push({ pos: `${ordinal(zeros[0].position)}–${ordinal(zeros[zeros.length - 1].position)}`, pts: 0 });
  return cells;
}

export default function RankingInfoModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<ScoringConfig | null>(null);

  useEffect(() => {
    api.scoring.get().then(setConfig).catch(() => {});
  }, []);

  const prior = config?.global_prior ?? 0;
  const ptsAt = (position: number) => config?.points.find((r) => r.position === position)?.points ?? 0;
  const rating = (points: number, gps: number) => (points / (prior + gps)).toFixed(2);
  const p1 = ptsAt(1);
  // Elo gained for beating someone `gap` points above you in a 1-vs-1 GP.
  const eloGain = (gap: number) =>
    config ? Math.round(config.season_elo_k * (1 - 1 / (1 + Math.pow(10, gap / config.season_elo_scale)))) : 0;
  const p3 = ptsAt(3);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-white font-black text-2xl italic tracking-tight">How Rankings Work</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {config?.global_kind === "elo" ? "Elo ratings, like in chess" : "Bayesian rating with experience weight"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white text-2xl transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {!config ? (
            <p className="text-gray-600 text-sm text-center py-12">Loading…</p>
          ) : (<>

          {config.global_kind === "elo" ? (
            <section>
              <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest mb-3">
                Global ranking — all-time Elo
              </p>
              <p className="text-gray-400 text-sm">
                The global ranking is an <span className="text-white font-medium">Elo rating that never resets</span>. Everyone starts at <span className="text-white font-medium">{config.season_elo_start}</span> on their first GP, and every GP since then moves it with the same duel formula as the seasons below: beat stronger players to climb, lose to weaker ones and you drop. Only the order between humans counts — bots are ignored.
              </p>
              <p className="text-gray-400 text-sm mt-3">
                With few GPs an Elo has barely moved from the start, so it says little about someone&apos;s level: players with fewer than <span className="text-white font-medium">{config.global_min_gp} GPs</span> are marked <span className="text-white font-medium">PROV</span> (provisional) and listed after everyone else until they reach it.
              </p>
            </section>
          ) : (
          <>
          {/* Step 1 — Points */}
          <section>
            <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest mb-3">
              Step 1 — Finish Position → Points
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Every Grand Prix awards points based on where you finish. Only human players are scored — bots fill the remaining slots silently.
            </p>
            <div className="grid grid-cols-4 gap-1">
              {pointsCells(config.points).map(({ pos, pts }) => (
                <div
                  key={pos}
                  className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2"
                >
                  <span className="text-gray-400 text-xs">{pos}</span>
                  <span className={`font-bold text-sm tabular-nums ${pts > 0 ? "text-[#00d4ff]" : "text-gray-700"}`}>
                    {pts}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Step 2 — Rating formula */}
          <section>
            <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest mb-3">
              Step 2 — Experience-Weighted Rating
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Raw totals favour whoever races the most. Instead, your rating is your total points divided by your games played — but with <span className="text-white font-medium">{prior} phantom zero-point races</span> added to the denominator. New players start near zero and must earn their rank through consistent results.
            </p>

            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-5 py-4 font-mono text-center">
              <p className="text-white text-lg">
                R = <span className="text-[#00d4ff]">Σ points</span>
                <span className="text-gray-600"> / </span>
                <span className="text-[#00d4ff]">({prior} + GPs played)</span>
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                { sym: "R", label: `Final rating — ranges from 0 to just below ${p1}` },
                { sym: "Σ points", label: "Sum of all GP points this player has ever scored" },
                { sym: String(prior), label: `Fixed prior: ${prior} phantom races at zero points, diluting early results` },
                { sym: "GPs played", label: "Total races entered; as this grows the prior loses influence" },
              ].map(({ sym, label }) => (
                <div key={sym} className="flex gap-3">
                  <span className="text-[#00d4ff] font-mono text-sm w-24 shrink-0">{sym}</span>
                  <span className="text-gray-400 text-sm">{label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Examples */}
          <section>
            <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest mb-3">
              In Practice
            </p>
            <div className="space-y-2">
              {[
                { label: `1 GP, P1 win (${p1} pts)`,          rating: rating(p1, 1),       note: "One great race counts little" },
                { label: `10 GPs, always P3 (${p3 * 10} pts)`, rating: rating(p3 * 10, 10), note: "Consistency starts to show" },
                { label: `20 GPs, always P1 (${p1 * 20} pts)`, rating: rating(p1 * 20, 20), note: "Dominance rewarded over time" },
                { label: "Max possible — P1 every race",      rating: `→ ${p1}`,          note: "Asymptotic ceiling, never reached" },
              ].map(({ label, rating, note }) => (
                <div key={label} className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{label}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{note}</p>
                  </div>
                  <span className="text-[#00d4ff] font-black text-lg tabular-nums shrink-0">{rating}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Summary callout */}
          <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              <span className="text-white font-semibold">The key insight:</span> winning one race takes you to {rating(p1, 1)}. Winning twenty takes you to {rating(p1 * 20, 20)}. You cannot shortcut the leaderboard — sustained front-running across many GPs is the only path to the top. Scores are locked in when each GP is submitted, so any change to these rules only applies to future GPs.
            </p>
          </section>

          </>
          )}

          {/* Seasons */}
          <section>
            <p className="text-[#00d4ff] text-xs font-semibold uppercase tracking-widest mb-3">
              Seasons
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Each calendar month is a <span className="text-white font-medium">Season</span>, scored with an <span className="text-white font-medium">Elo rating</span> like in chess — independent of the global ranking. On the 1st everyone starts at <span className="text-white font-medium">{config.season_elo_start}</span>. In every GP, each pair of players is a duel: finishing ahead wins it, a shared position is a draw. Beating stronger players earns a lot, beating weaker ones earns little.
            </p>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-5 py-4 font-mono text-center mb-4">
              <p className="text-white text-base">
                change = <span className="text-[#00d4ff]">{config.season_elo_k}</span> × Σ(result − expected) / opponents
              </p>
              <p className="text-gray-500 text-xs mt-2">
                expected = 1 / (1 + 10^((their Elo − your Elo) / {config.season_elo_scale}))
              </p>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { label: "Win a duel against an equal player", value: eloGain(0) },
                { label: "Beat someone 200 Elo above you", value: eloGain(200) },
                { label: "Beat someone 200 Elo below you", value: eloGain(-200) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
                  <p className="text-white text-xs font-medium">{label} <span className="text-gray-600">(1 vs 1)</span></p>
                  <span className="text-[#00d4ff] font-black text-lg tabular-nums shrink-0">+{value}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { icon: "🏆", label: "Season winner", desc: `The highest Elo at month end among players with at least ${config.season_min_gp} GPs that month. Players below that are marked PROV (provisional). Ties broken by number of P1 finishes.` },
                { icon: "Season / Global", label: "Toggle", desc: "Switch the leaderboard between the current season ranking and the all-time global ranking." },
                { icon: "Seasons won", label: "Column", desc: "Total number of monthly seasons each player has won. Shown on every row — it survives a poor current season." },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3">
                  <span className="text-white font-mono text-xs w-28 shrink-0 pt-0.5">{icon}</span>
                  <div>
                    <p className="text-white text-xs font-semibold">{label}</p>
                    <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          </>)}
        </div>
      </motion.div>
    </motion.div>
  );
}
