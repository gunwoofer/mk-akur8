"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";

interface Props {
  racers: Player[];
  positions: Record<string, number>;
  activePlayer: string | null;
  onToggle: (playerId: string) => void;
  onPick: (playerId: string, position: number) => void;
  // Final ranking: several players may share a spot. Races: a spot belongs to one player.
  allowTies?: boolean;
}

// One row per racer; tapping a row opens a 1–24 keypad under it.
export default function PositionRows({ racers, positions, activePlayer, onToggle, onPick, allowTies = false }: Props) {
  const holders = (n: number, except: string) => racers.filter((r) => r.id !== except && positions[r.id] === n);

  return (
    <div className="space-y-1.5">
      {racers.map((p) => {
        const pos = positions[p.id];
        const open = activePlayer === p.id;
        const tied = allowTies && pos !== undefined && holders(pos, p.id).length > 0;
        return (
          <div key={p.id} className="rounded-2xl border border-[#1e1e1e] bg-[#141414] overflow-hidden">
            <button onClick={() => onToggle(p.id)} className="w-full flex items-center px-4 py-3 text-left">
              <AvatarDisplay avatarUrl={p.avatar_url} characterAvatar={p.character_avatar} imgClassName="w-8 h-8 mr-3" emojiClassName="text-2xl mr-3" />
              <span className="flex-1 text-white text-sm font-semibold truncate">{p.name}</span>
              <span className={`min-w-[3rem] text-center rounded-lg px-2 py-1 text-sm font-black tabular-nums ${
                pos ? "bg-[#00d4ff] text-black" : open ? "bg-[#00d4ff]/15 text-[#00d4ff]" : "bg-[#1f1f1f] text-gray-600"
              }`}>
                {pos ? `P${pos}${tied ? " =" : ""}` : "–"}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="grid grid-cols-6 gap-1.5 px-3 pb-3">
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => {
                      const others = holders(n, p.id);
                      return (
                        <button
                          key={n}
                          onClick={() => onPick(p.id, n)}
                          className={`relative py-2.5 rounded-lg text-sm font-bold tabular-nums ${
                            pos === n ? "bg-[#00d4ff] text-black"
                              : others.length && !allowTies ? "bg-[#111] text-gray-700"
                              : others.length ? "bg-[#1f1f1f] text-white ring-1 ring-[#00d4ff]/40"
                              : n <= 12 ? "bg-[#1f1f1f] text-white active:bg-[#2a2a2a]"
                              : "bg-[#181818] text-gray-400 active:bg-[#2a2a2a]"
                          }`}
                        >
                          {n}
                          {allowTies && others[0] && (
                            <span className="absolute" style={{ top: 2, right: 2 }}>
                              <AvatarDisplay avatarUrl={others[0].avatar_url} characterAvatar={others[0].character_avatar} imgClassName="w-3.5 h-3.5" emojiClassName="text-[10px] leading-none" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
