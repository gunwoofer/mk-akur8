"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { Player } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";

interface Props {
  position: number;
  players: Player[];
  onClearPlayer: (playerId: string) => void;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function PlayerChip({ player, onClear }: { player: Player; onClear: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `player-${player.id}`,
    data: { playerId: player.id },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 cursor-grab active:cursor-grabbing touch-none select-none transition-opacity ${isDragging ? "opacity-20" : "opacity-100"}`}
    >
      <AvatarDisplay
        avatarUrl={player.avatar_url}
        characterAvatar={player.character_avatar}
        imgClassName="w-5 h-5"
        emojiClassName="text-base shrink-0 leading-none"
      />
      <span className="text-white text-xs font-semibold flex-1 min-w-0 truncate">{player.name}</span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onClear(); }}
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-[#333] hover:text-gray-400 hover:bg-[#252525] transition-colors text-xs leading-none"
      >
        ✕
      </button>
    </div>
  );
}

export default function PositionSlot({ position, players, onClearPlayer }: Props) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${position}`,
    data: { position },
  });

  const isEmpty = players.length === 0;
  const isTied = players.length > 1;

  return (
    <div
      ref={setNodeRef}
      className={`flex items-start gap-2.5 min-h-10 rounded-xl px-3 py-2 transition-all ${
        isOver
          ? "border border-[#00d4ff] bg-[#00d4ff]/10 shadow-[0_0_14px_rgba(0,212,255,0.12)]"
          : !isEmpty
          ? "border border-[#232323] bg-[#161616] hover:border-[#2e2e2e]"
          : "border border-dashed border-[#1c1c1c]"
      }`}
    >
      <span className={`shrink-0 w-6 text-right text-xs font-bold pt-0.5 ${MEDAL[position] ? "text-base leading-none" : "text-gray-700"}`}>
        {MEDAL[position] ?? position}
      </span>

      {isEmpty ? (
        <span className="text-[#282828] text-xs italic flex-1 pt-0.5">bot</span>
      ) : (
        <div className="flex-1 min-w-0 space-y-1.5">
          {isTied && (
            <span className="text-[10px] text-[#00d4ff]/70 font-bold uppercase tracking-wider">Tie</span>
          )}
          {players.map((player) => (
            <PlayerChip
              key={player.id}
              player={player}
              onClear={() => onClearPlayer(player.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
