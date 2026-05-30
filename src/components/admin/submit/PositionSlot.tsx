import { useDroppable } from "@dnd-kit/core";
import type { Player } from "@/types";

interface Props {
  position: number;
  player: Player | null;
  onClear?: () => void;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function PositionSlot({ position, player, onClear }: Props) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${position}`,
    data: { position },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 h-12 rounded-lg border px-3 transition-all ${
        isOver
          ? "border-[#00d4ff] bg-[#00d4ff]/10"
          : player
          ? "border-[#00d4ff]/40 bg-[#1a1a1a]"
          : "border-[#2a2a2a] bg-[#141414]"
      }`}
    >
      <span className="text-gray-600 font-bold text-xs w-5 text-right shrink-0">
        {MEDAL[position] ?? position}
      </span>

      {player ? (
        <>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base">{player.character_avatar}</span>
            <span className="text-white text-xs font-semibold truncate">{player.name}</span>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="text-gray-600 hover:text-red-400 text-sm shrink-0 transition-colors"
              aria-label="Remove player from slot"
            >
              ✕
            </button>
          )}
        </>
      ) : (
        <span className="text-gray-700 text-xs flex-1">🤖 Bot</span>
      )}
    </div>
  );
}
