"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Player } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";
import PositionRows from "./PositionRows";

interface Props {
  racers: Player[];
  ranking: Record<string, number>;
  prefilled: boolean;
  backLabel: string;
  submitting: boolean;
  submitError: string | null;
  onSetPosition: (playerId: string, position: number | null) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export default function PositionsStep({
  racers, ranking, prefilled, backLabel, submitting, submitError, onSetPosition, onSubmit, onBack,
}: Props) {
  // Mounted on entering the step: open the keypad on the first racer without a position,
  // or on the first racer when everything is pre-filled.
  const [activePlayer, setActivePlayer] = useState<string | null>(() =>
    (racers.find((p) => ranking[p.id] === undefined) ?? racers[0])?.id ?? null);

  const placed = racers.filter((p) => ranking[p.id] !== undefined);
  const complete = placed.length === racers.length && racers.length > 0;
  const order = [...placed].sort((a, b) => ranking[a.id] - ranking[b.id]);
  const shared = (pos: number) => placed.filter((p) => ranking[p.id] === pos).length > 1;

  const pick = (playerId: string, position: number) => {
    onSetPosition(playerId, ranking[playerId] === position ? null : position);
    // Next row down even when it's already filled (pre-filled from races); after the last row,
    // back to anyone still missing a position.
    const index = racers.findIndex((p) => p.id === playerId);
    const next = racers[index + 1] ?? racers.find((p) => p.id !== playerId && ranking[p.id] === undefined);
    setActivePlayer(next?.id ?? null);
  };

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between pt-1 pb-3">
        <button onClick={onBack} className="text-gray-500 text-sm">← {backLabel}</button>
        <span className="text-gray-500 text-xs tabular-nums">{placed.length} / {racers.length} placed</span>
      </div>

      <h2 className="text-white font-bold text-lg leading-none">Final ranking</h2>
      <p className="text-gray-600 text-xs mt-1 mb-3">
        {prefilled ? "Pre-filled from the race points — check and adjust. " : ""}
        GP position (1–24) · players can share a spot
      </p>

      <PositionRows
        racers={racers}
        positions={ranking}
        activePlayer={activePlayer}
        onToggle={(id) => setActivePlayer(activePlayer === id ? null : id)}
        onPick={pick}
        allowTies
      />

      <div className="sticky bottom-0 bg-[#0a0a0a] pt-3 pb-1 mt-3">
        {order.length > 0 && (
          <div className="flex flex-wrap items-center mb-3">
            {order.map((p) => {
              const pos = ranking[p.id];
              return (
                <span key={p.id} className="flex items-center mr-3 mb-1 text-xs">
                  <span className="text-[#00d4ff] font-black tabular-nums mr-1">
                    {pos === 1 ? "🥇" : `P${pos}${shared(pos) ? "=" : ""}`}
                  </span>
                  <AvatarDisplay avatarUrl={p.avatar_url} characterAvatar={p.character_avatar} imgClassName="w-4 h-4 mr-1" emojiClassName="text-sm mr-1" />
                  <span className="text-white font-semibold">{p.name}</span>
                </span>
              );
            })}
          </div>
        )}
        {submitError && <p className="text-red-400 text-xs text-center mb-2">{submitError}</p>}
        <motion.button
          onClick={onSubmit}
          disabled={submitting || !complete}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3.5 bg-[#00d4ff] text-black font-bold text-sm rounded-2xl disabled:opacity-30 tracking-wide"
        >
          {submitting ? "Submitting…" : complete ? `Submit GP · ${racers.length} racers 🏁` : "Give everyone a position"}
        </motion.button>
      </div>
    </div>
  );
}
