"use client";

import { useDraggable } from "@dnd-kit/core";
import type { Player } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";

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
      className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border select-none cursor-grab active:cursor-grabbing transition-all touch-none ${
        isDragging
          ? "opacity-20 scale-95"
          : "border-[#242424] bg-[#161616] hover:border-[#2e2e2e] hover:bg-[#1c1c1c]"
      }`}
    >
      <AvatarDisplay avatarUrl={player.avatar_url} characterAvatar={player.character_avatar} imgClassName="w-5 h-5" emojiClassName="text-base leading-none" />
      <span className="text-white text-xs font-semibold">{player.name}</span>
    </div>
  );
}
