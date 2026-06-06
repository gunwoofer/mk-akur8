"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Player } from "@/types";

export type Step = 1 | 2 | 3;

export interface Slot {
  position: number;
  playerIds: string[];
}

function emptySlots(): Slot[] {
  return Array.from({ length: 24 }, (_, i) => ({ position: i + 1, playerIds: [] }));
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
  const [lastResults, setLastResults] = useState<Slot[]>([]);

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

  // Remove player from current slot, then add to target slot.
  // If target already has players, they tie at that position.
  const placePlayer = (playerId: string, targetPosition: number) =>
    setSlots((prev) => {
      const withoutPlayer = prev.map((s) => ({
        ...s,
        playerIds: s.playerIds.filter((id) => id !== playerId),
      }));
      return withoutPlayer.map((s) =>
        s.position === targetPosition
          ? { ...s, playerIds: [...s.playerIds, playerId] }
          : s
      );
    });

  const clearPlayer = (playerId: string) =>
    setSlots((prev) =>
      prev.map((s) => ({ ...s, playerIds: s.playerIds.filter((id) => id !== playerId) }))
    );

  const submit = async (): Promise<boolean> => {
    const results = slots.flatMap((s) =>
      s.playerIds.map((id) => ({ player_id: id, position: s.position }))
    );

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
        .filter((s) => s.playerIds.length > 0)
        .sort((a, b) => a.position - b.position)[0];
      const winnerId = winnerSlot?.playerIds[0];
      const winner = winnerId ? players.find((p) => p.id === winnerId) : null;
      if (winner) {
        const supabase = getSupabase();
        const ch = supabase.channel("leaderboard-live");
        ch.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.send({
              type: "broadcast",
              event: "gp_submitted",
              payload: { name: winner.name, character_avatar: winner.character_avatar, avatar_url: winner.avatar_url },
            });
            supabase.removeChannel(ch);
          }
        });
      }

      setLastResults(slots.filter((s) => s.playerIds.length > 0));
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
  const goToPositions = useCallback(() => {
    const ordered = [...players]
      .filter((p) => selected.has(p.id))
      .sort((a, b) => b.rating - a.rating);
    setSlots(
      Array.from({ length: 24 }, (_, i) => ({
        position: i + 1,
        playerIds: ordered[i] ? [ordered[i].id] : [],
      }))
    );
    setStep(2);
  }, [players, selected]);

  const rematch = useCallback(() => {
    setSlots(
      Array.from({ length: 24 }, (_, i) => {
        const last = lastResults.find((s) => s.position === i + 1);
        return { position: i + 1, playerIds: last?.playerIds ?? [] };
      })
    );
    setStep(2);
  }, [lastResults]);

  const reset = () => {
    setSelected(new Set());
    setSlots(emptySlots());
    setLastResults([]);
    setStep(1);
    setSubmitError(null);
  };

  const placedIds = new Set(slots.flatMap((s) => s.playerIds));

  return {
    step, setStep, goToPositions,
    players, loadingPlayers, fetchError,
    selected, toggleSelect,
    slots, placePlayer, clearPlayer,
    submitting, submitError,
    submit, reset, rematch,
    placedIds,
    playerById: (id: string) => players.find((p) => p.id === id) ?? null,
  };
}
