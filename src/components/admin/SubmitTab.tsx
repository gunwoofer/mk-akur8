"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { Player } from "@/types";

// ── Types ──────────────────────────────────────────────────
type Step = 1 | 2 | 3;

interface Slot {
  position: number;
  playerId: string | null; // null = bot
}

// ── Draggable player card (in bench or slot) ───────────────
function DraggablePlayer({
  player,
  inSlot,
}: {
  player: Player;
  inSlot?: boolean;
}) {
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
      } ${inSlot ? "bg-[#00d4ff]/10 border border-[#00d4ff]/40" : "bg-[#242424] border border-[#333]"}`}
    >
      <span className="text-lg">{player.character_avatar}</span>
      <span className="text-white text-xs font-semibold truncate max-w-[80px]">{player.name}</span>
    </div>
  );
}

// ── Droppable position slot ────────────────────────────────
function PositionSlot({
  position,
  player,
  onClear,
}: {
  position: number;
  player: Player | null;
  onClear?: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${position}`,
    data: { position },
  });

  const medal =
    position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : null;

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
        {medal ?? position}
      </span>

      {player ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base">{player.character_avatar}</span>
          <span className="text-white text-xs font-semibold truncate">{player.name}</span>
        </div>
      ) : (
        <span className="text-gray-700 text-xs flex-1">🤖 Bot</span>
      )}

      {player && onClear && (
        <button
          onClick={onClear}
          className="text-gray-600 hover:text-red-400 text-sm shrink-0 transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function SubmitTab() {
  const [step, setStep] = useState<Step>(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Slot[]>(
    Array.from({ length: 24 }, (_, i) => ({ position: i + 1, playerId: null }))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((d) => { setPlayers(d ?? []); setLoadingPlayers(false); });
  }, []);

  // Reset slots when going back to step 1
  const resetFlow = useCallback(() => {
    setSelected(new Set());
    setSlots(Array.from({ length: 24 }, (_, i) => ({ position: i + 1, playerId: null })));
    setStep(1);
    setSubmitSuccess(false);
    setSubmitError(null);
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Players currently placed in slots
  const placedIds = new Set(slots.map((s) => s.playerId).filter(Boolean) as string[]);
  // Selected players not yet placed → bench
  const benchPlayers = players.filter((p) => selected.has(p.id) && !placedIds.has(p.id));

  const playerById = (id: string) => players.find((p) => p.id === id) ?? null;

  const activeDragPlayer = activeId ? playerById(activeId.replace("player-", "")) : null;

  function handleDragStart(event: DragStartEvent) {
    const pid = event.active.data.current?.playerId as string | undefined;
    setActiveId(pid ? `player-${pid}` : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const overId = event.over?.id as string | undefined;
    const playerId = event.active.data.current?.playerId as string | undefined;

    if (!overId || !playerId) return;

    if (overId.startsWith("slot-")) {
      const targetPos = parseInt(overId.replace("slot-", ""), 10);

      setSlots((prev) => {
        const next = prev.map((s) => ({ ...s }));
        // Remove player from any existing slot
        next.forEach((s) => { if (s.playerId === playerId) s.playerId = null; });
        // Check if target slot already has a human player → bump back to bench
        const target = next.find((s) => s.position === targetPos)!;
        target.playerId = playerId;
        return next;
      });
    }
  }

  function clearSlot(position: number) {
    setSlots((prev) => prev.map((s) => s.position === position ? { ...s, playerId: null } : s));
  }

  async function submitMatch() {
    setSubmitting(true);
    setSubmitError(null);

    const results = slots
      .filter((s) => s.playerId !== null)
      .map((s) => ({ player_id: s.playerId!, position: s.position }));

    if (results.length === 0) {
      setSubmitError("Place at least one player before submitting.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    });

    if (res.ok) {
      setSubmitSuccess(true);
      setStep(3);
    } else {
      const d = await res.json();
      setSubmitError(d.error ?? "Submission failed.");
    }
    setSubmitting(false);
  }

  // ── STEP 1: Lobby selection ──────────────────────────────
  if (step === 1) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-white font-bold text-xl mb-1">Select Lobby</h2>
          <p className="text-gray-500 text-xs">Check everyone who raced in this GP.</p>
        </div>

        {loadingPlayers ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : players.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">
            No players found. Add players in the Players tab first.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selected.has(p.id)
                      ? "border-[#00d4ff] bg-[#00d4ff]/10"
                      : "border-[#2a2a2a] bg-[#1a1a1a]"
                  }`}
                >
                  <span className="text-2xl">{p.character_avatar}</span>
                  <span className="text-white text-sm font-semibold truncate">{p.name}</span>
                  {selected.has(p.id) && (
                    <span className="ml-auto text-[#00d4ff] text-lg">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="sticky bottom-0 bg-[#0a0a0a] pt-2 pb-1">
              <button
                onClick={() => setStep(2)}
                disabled={selected.size === 0}
                className="w-full py-4 bg-[#00d4ff] text-black font-black text-base rounded-xl disabled:opacity-40 transition-opacity tracking-wide"
              >
                Next → Assign Positions ({selected.size} selected)
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── STEP 2: Drag & Drop positions ────────────────────────
  if (step === 2) {
    return (
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col min-h-[calc(100vh-120px)]">
          {/* Header bar */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-3">
            <button
              onClick={() => setStep(1)}
              className="text-gray-500 hover:text-white text-sm transition-colors"
            >
              ← Back
            </button>
            <div>
              <h2 className="text-white font-bold text-lg leading-none">Assign Positions</h2>
              <p className="text-gray-500 text-xs">Drag players from bench into finishing slots.</p>
            </div>
          </div>

          {/* Slots list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
            {slots.map((slot) => (
              <PositionSlot
                key={slot.position}
                position={slot.position}
                player={slot.playerId ? playerById(slot.playerId) : null}
                onClear={slot.playerId ? () => clearSlot(slot.position) : undefined}
              />
            ))}
          </div>

          {/* Bench + Submit */}
          <div className="sticky bottom-0 bg-[#0a0a0a] border-t border-[#2a2a2a] p-3 space-y-3">
            {benchPlayers.length > 0 && (
              <div>
                <p className="text-gray-600 text-xs mb-2 uppercase tracking-widest">Bench — drag to assign</p>
                <div className="flex flex-wrap gap-2">
                  {benchPlayers.map((p) => (
                    <DraggablePlayer key={p.id} player={p} />
                  ))}
                </div>
              </div>
            )}

            {submitError && (
              <p className="text-red-400 text-xs text-center">{submitError}</p>
            )}

            <button
              onClick={submitMatch}
              disabled={submitting || placedIds.size === 0}
              className="w-full py-4 bg-[#00d4ff] text-black font-black text-base rounded-xl disabled:opacity-40 transition-opacity tracking-wide"
            >
              {submitting ? "Submitting…" : "Submit Match 🏁"}
            </button>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragPlayer ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00d4ff] border border-[#00d4ff] opacity-90 shadow-lg">
              <span className="text-lg">{activeDragPlayer.character_avatar}</span>
              <span className="text-black text-xs font-bold">{activeDragPlayer.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  // ── STEP 3: Success ──────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-6">
      <div className="text-6xl animate-bounce">🏆</div>
      <div>
        <p className="text-white font-black text-2xl mb-2">Match Submitted!</p>
        <p className="text-gray-500 text-sm">
          Ratings have been recalculated. The dashboard will update in real time.
        </p>
      </div>
      <button
        onClick={resetFlow}
        className="px-8 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-xl font-semibold text-sm hover:border-[#00d4ff] transition-colors"
      >
        Submit Another GP
      </button>
    </div>
  );
}
