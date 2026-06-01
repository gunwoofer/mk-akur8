"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
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
      const fromSlot = next.find((s) => s.playerId === playerId);
      const toSlot = next.find((s) => s.position === targetPosition)!;
      const displaced = toSlot.playerId;
      toSlot.playerId = playerId;
      if (fromSlot) fromSlot.playerId = displaced; // swap; bench-drag keeps displaced on bench
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

      // DB is fully committed at this point. Push winner to the dashboard immediately
      // via Supabase broadcast — no polling lag, no dependency on postgres_changes.
      const winnerSlot = slots
        .filter((s) => s.playerId !== null)
        .sort((a, b) => a.position - b.position)[0];
      const winner = winnerSlot?.playerId ? players.find((p) => p.id === winnerSlot.playerId) : null;
      if (winner) {
        const supabase = getSupabase();
        const ch = supabase.channel("leaderboard-live");
        ch.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.send({
              type: "broadcast",
              event: "gp_submitted",
              payload: { name: winner.name, character_avatar: winner.character_avatar },
            });
            supabase.removeChannel(ch);
          }
        });
      }

      setStep(3);
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Pre-fill positions 1…N with the selected players sorted by current rating.
  // Called instead of setStep(2) so the user starts with a sensible default.
  const goToPositions = useCallback(() => {
    const ordered = [...players]
      .filter((p) => selected.has(p.id))
      .sort((a, b) => b.rating - a.rating);
    setSlots(
      Array.from({ length: 24 }, (_, i) => ({
        position: i + 1,
        playerId: ordered[i]?.id ?? null,
      }))
    );
    setStep(2);
  }, [players, selected]);

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
    step, setStep, goToPositions,
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
