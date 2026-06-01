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
import DraggablePlayer from "./DraggablePlayer";
import PositionSlot from "./PositionSlot";

interface Props {
  slots: Slot[];
  benchPlayers: Player[];
  playerById: (id: string) => Player | null;
  placedIds: Set<string>;
  submitting: boolean;
  submitError: string | null;
  onPlacePlayer: (playerId: string, position: number) => void;
  onClearSlot: (position: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export default function PositionsStep({
  slots, benchPlayers, playerById,
  placedIds, submitting, submitError,
  onPlacePlayer, onClearSlot, onSubmit, onBack,
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
            <p className="text-gray-600 text-xs mt-0.5">Drag to swap · tap ✕ to clear</p>
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
              player={slot.playerId ? playerById(slot.playerId) : null}
              onClear={slot.playerId ? () => onClearSlot(slot.position) : undefined}
            />
          ))}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-[#181818] px-4 pt-3 pb-4 space-y-3">
          {benchPlayers.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-700 mb-2">
                Bench · drag to place
              </p>
              <div className="flex flex-wrap gap-2">
                {benchPlayers.map((p) => <DraggablePlayer key={p.id} player={p} />)}
              </div>
            </div>
          )}
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
            <span className="text-base leading-none">{activePlayer.character_avatar}</span>
            <span className="text-white text-xs font-bold">{activePlayer.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
