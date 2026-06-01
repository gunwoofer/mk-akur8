"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { Player } from "@/types";

interface Props {
  position: number;
  player: Player | null;
  onClear?: () => void;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function PositionSlot({ position, player, onClear }: Props) {
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `slot-${position}`,
    data: { position },
  });

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: player ? `player-${player.id}` : `empty-${position}`,
    data: { playerId: player?.id },
    disabled: !player,
  });

  const setRef = (el: HTMLElement | null) => { setDropRef(el); setDragRef(el); };

  return (
    <div
      ref={setRef}
      {...(player ? listeners : {})}
      {...(player ? attributes : {})}
      className={`flex items-center gap-2.5 h-10 rounded-xl px-3 select-none transition-all ${
        player ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      } ${isDragging ? "opacity-20 scale-[0.97]" : ""} ${
        isOver
          ? "border border-[#00d4ff] bg-[#00d4ff]/10 shadow-[0_0_14px_rgba(0,212,255,0.12)]"
          : player
          ? "border border-[#232323] bg-[#161616] hover:border-[#2e2e2e]"
          : "border border-dashed border-[#1c1c1c]"
      }`}
    >
      <span className={`shrink-0 w-6 text-right text-xs font-bold ${MEDAL[position] ? "text-base leading-none" : "text-gray-700"}`}>
        {MEDAL[position] ?? position}
      </span>

      {player ? (
        <>
          <span className="text-base shrink-0 leading-none">{player.character_avatar}</span>
          <span className="text-white text-xs font-semibold flex-1 min-w-0 truncate">{player.name}</span>
          {onClear && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClear}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-[#333] hover:text-gray-400 hover:bg-[#252525] transition-colors text-xs leading-none"
            >
              ✕
            </button>
          )}
        </>
      ) : (
        <span className="text-[#282828] text-xs italic flex-1">bot</span>
      )}
    </div>
  );
}
