"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Player } from "@/types";

export type Step = 1 | 2 | 3;

export interface Slot {
  position: number;
  playerId: string | null;
}

function emptySlots(): Slot[] {
  return Array.from({ length: 24 }, (_, i) => ({ position: i + 1, playerId: null }));
}

export function useSubmitFlow() {
  const [step, setStep] = useState<Step>(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Slot[]>(emptySlots);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchPlayers = useCallback(async () => {
    setLoadingPlayers(true);
    setFetchError(null);
    try {
      setPlayers(await api.players.list());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load players");
    } finally {
      setLoadingPlayers(false);
    }
  }, []);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const placePlayer = (playerId: string, targetPosition: number) =>
    setSlots((prev) => {
      const next = prev.map((s) => ({ ...s }));
      next.forEach((s) => { if (s.playerId === playerId) s.playerId = null; });
      next.find((s) => s.position === targetPosition)!.playerId = playerId;
      return next;
    });

  const clearSlot = (position: number) =>
    setSlots((prev) =>
      prev.map((s) => (s.position === position ? { ...s, playerId: null } : s))
    );

  const submit = async (): Promise<boolean> => {
    const results = slots
      .filter((s) => s.playerId !== null)
      .map((s) => ({ player_id: s.playerId!, position: s.position }));

    if (results.length === 0) {
      setSubmitError("Place at least one player before submitting.");
      return false;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.matches.submit(results);
      setStep(3);
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSelected(new Set());
    setSlots(emptySlots());
    setStep(1);
    setSubmitError(null);
  };

  const placedIds = new Set(
    slots.map((s) => s.playerId).filter((id): id is string => id !== null)
  );

  return {
    step, setStep,
    players, loadingPlayers, fetchError,
    selected, toggleSelect,
    slots, placePlayer, clearSlot,
    submitting, submitError,
    submit, reset,
    placedIds,
    benchPlayers: players.filter((p) => selected.has(p.id) && !placedIds.has(p.id)),
    playerById: (id: string) => players.find((p) => p.id === id) ?? null,
  };
}
