import { useDraggable } from "@dnd-kit/core";
import type { Player } from "@/types";

interface Props {
  player: Player;
  inSlot?: boolean;
}

export default function DraggablePlayer({ player, inSlot }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `player-${player.id}`,
    data: { playerId: player.id },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isDragging ? "opacity-30" : "opacity-100"
      } ${inSlot
        ? "bg-[#00d4ff]/10 border border-[#00d4ff]/40"
        : "bg-[#242424] border border-[#333]"
      }`}
    >
      <span className="text-lg">{player.character_avatar}</span>
      <span className="text-white text-xs font-semibold truncate max-w-[80px]">{player.name}</span>
    </div>
  );
}
