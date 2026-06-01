"use client";

import { useDraggable } from "@dnd-kit/core";
import type { Player } from "@/types";

export default function DraggablePlayer({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `player-${player.id}`,
    data: { playerId: player.id },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border select-none cursor-grab active:cursor-grabbing transition-all ${
        isDragging
          ? "opacity-20 scale-95"
          : "border-[#242424] bg-[#161616] hover:border-[#2e2e2e] hover:bg-[#1c1c1c]"
      }`}
    >
      <span className="text-base leading-none">{player.character_avatar}</span>
      <span className="text-white text-xs font-semibold">{player.name}</span>
    </div>
  );
}
