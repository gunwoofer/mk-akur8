"use client";

import { useState } from "react";
import {
  DndContext, DragEndEvent, DragStartEvent,
  DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import type { Slot } from "@/hooks/useSubmitFlow";
import type { Player } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";
import PositionSlot from "./PositionSlot";

interface Props {
  slots: Slot[];
  playerById: (id: string) => Player | null;
  placedIds: Set<string>;
  submitting: boolean;
  submitError: string | null;
  onPlacePlayer: (playerId: string, position: number) => void;
  onClearPlayer: (playerId: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export default function PositionsStep({
  slots, playerById,
  placedIds, submitting, submitError,
  onPlacePlayer, onClearPlayer, onSubmit, onBack,
}: Props) {
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
  );

  function handleDragStart(e: DragStartEvent) {
    setActivePlayerId(e.active.data.current?.playerId as string ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActivePlayerId(null);
    const overId = e.over?.id as string | undefined;
    const playerId = e.active.data.current?.playerId as string | undefined;
    if (!overId?.startsWith("slot-") || !playerId) return;
    onPlacePlayer(playerId, parseInt(overId.replace("slot-", ""), 10));
  }

  const activePlayer = activePlayerId ? playerById(activePlayerId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div>
        {/* Header */}
        <div className="px-4 pt-2 pb-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-white text-sm transition-colors"
          >
            ← Back
          </button>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base leading-none">Assign Positions</h2>
            <p className="text-gray-600 text-xs mt-0.5">Drag to move · drop on player to tie · tap ✕ to remove</p>
          </div>
          <div className="text-right">
            <p className="text-[#00d4ff] text-sm font-bold leading-none">{placedIds.size}</p>
            <p className="text-gray-700 text-[10px]">placed</p>
          </div>
        </div>

        {/* Slot list */}
        <div className="px-4 pb-2 space-y-0.5">
          {slots.map((slot) => (
            <PositionSlot
              key={slot.position}
              position={slot.position}
              players={slot.playerIds.map((id) => playerById(id)).filter((p): p is Player => p !== null)}
              onClearPlayer={onClearPlayer}
            />
          ))}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 bg-[#0a0a0a]/95 border-t border-[#181818] px-4 pt-3 pb-4 space-y-3">
          {submitError && (
            <p className="text-red-400 text-xs text-center">{submitError}</p>
          )}
          <motion.button
            onClick={onSubmit}
            disabled={submitting || placedIds.size === 0}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 bg-[#00d4ff] text-black font-bold text-sm rounded-2xl disabled:opacity-30 transition-opacity tracking-wide"
          >
            {submitting
              ? "Submitting…"
              : `Submit GP · ${placedIds.size} racer${placedIds.size !== 1 ? "s" : ""} 🏁`}
          </motion.button>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePlayer && (
          <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-[#00d4ff]/60 bg-[#00d4ff]/15 shadow-xl shadow-[#00d4ff]/10">
            <AvatarDisplay
              avatarUrl={activePlayer.avatar_url}
              characterAvatar={activePlayer.character_avatar}
              imgClassName="w-5 h-5"
              emojiClassName="text-base leading-none"
            />
            <span className="text-white text-xs font-bold">{activePlayer.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
