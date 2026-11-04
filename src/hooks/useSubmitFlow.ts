"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { RACE_POINTS } from "@/lib/tracks";
import type { Player, RaceSubmission, Track } from "@/types";

// 1 Lobby → 2 Races (only when recording races) → 3 Final ranking → 4 Done
export type Step = 1 | 2 | 3 | 4;

export interface Slot {
  position: number;
  playerIds: string[];
}

export interface RaceDraft {
  trackId: string | null;
  positions: Record<string, number>;   // player id → finish position (1–24)
}

export const MIN_RACES = 2;
export const MAX_RACES = 6;
const DEFAULT_RACES = 4;
const DRAFT_KEY = "mk-akur8:gp-draft";

interface Draft {
  selected: string[];
  races: RaceDraft[];
  raceIndex: number;
  step: Step;
}

function emptySlots(): Slot[] {
  return Array.from({ length: 24 }, (_, i) => ({ position: i + 1, playerIds: [] }));
}

const emptyRace = (): RaceDraft => ({ trackId: null, positions: {} });

export function isRaceComplete(race: RaceDraft, playerIds: string[]): boolean {
  return race.trackId !== null && playerIds.every((id) => race.positions[id] !== undefined);
}

// localStorage can be unavailable (private mode) — the flow must still work without it.
function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // non-critical
  }
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

  const [recordRaces, setRecordRaces] = useState(false);
  const [races, setRaces] = useState<RaceDraft[]>([]);
  const [raceIndex, setRaceIndex] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);

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

  useEffect(() => {
    if (recordRaces && tracks.length === 0) api.tracks.list().then(setTracks).catch(() => {});
  }, [recordRaces, tracks.length]);

  // Pick a GP in progress back up after the phone locked or the page reloaded between races.
  // Has to run after mount: localStorage doesn't exist during the server render.
  useEffect(() => {
    if (loadingPlayers || draftRestored) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftRestored(true);
    const draft = readDraft();
    if (!draft) return;
    const known = new Set(players.map((p) => p.id));
    const ids = draft.selected.filter((id) => known.has(id));
    if (ids.length === 0) { writeDraft(null); return; }
    setSelected(new Set(ids));
    setRecordRaces(true);
    setRaces(draft.races);
    setRaceIndex(Math.min(draft.raceIndex, draft.races.length - 1));
    setStep(2);
  }, [loadingPlayers, draftRestored, players]);

  useEffect(() => {
    if (!draftRestored) return;
    writeDraft(recordRaces && step === 2 ? { selected: [...selected], races, raceIndex, step } : null);
  }, [draftRestored, recordRaces, step, selected, races, raceIndex]);

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

  /* ── Race-by-race entry ───────────────────────────────────────────────── */

  const startRaces = () => {
    const ids = [...selected];
    setRaces((prev) => {
      if (prev.length === 0) return Array.from({ length: DEFAULT_RACES }, emptyRace);
      // Back from the lobby: forget positions of racers who were unselected.
      return prev.map((r) => ({
        ...r,
        positions: Object.fromEntries(Object.entries(r.positions).filter(([id]) => ids.includes(id))),
      }));
    });
    setStep(2);
  };

  const setRaceTrack = (index: number, trackId: string | null) =>
    setRaces((prev) => prev.map((r, i) => (i === index ? { ...r, trackId } : r)));

  // A position is unique within a race: taking it frees it from whoever had it.
  const setRacePosition = (index: number, playerId: string, position: number | null) =>
    setRaces((prev) => prev.map((r, i) => {
      if (i !== index) return r;
      const positions = Object.fromEntries(
        Object.entries(r.positions).filter(([id, pos]) => id !== playerId && pos !== position));
      if (position !== null) positions[playerId] = position;
      return { ...r, positions };
    }));

  const setRaceCount = (count: number) => {
    const n = Math.max(MIN_RACES, Math.min(MAX_RACES, count));
    setRaces((prev) => (n > prev.length
      ? [...prev, ...Array.from({ length: n - prev.length }, emptyRace)]
      : prev.slice(0, n)));
    setRaceIndex((i) => Math.min(i, n - 1));
  };

  /* ── Final ranking ────────────────────────────────────────────────────── */

  // Pre-fill positions 1…N. With recorded races: by total race points (Mario Kart World
  // scale), ties to the better last race. Otherwise by current rating.
  const goToPositions = useCallback(() => {
    const chosen = players.filter((p) => selected.has(p.id));
    let ordered: Player[];
    // "End GP here" trims the race list in the same tick: only count races with a track.
    const played = races.filter((r) => r.trackId !== null);
    if (recordRaces && played.length > 0) {
      const points = (id: string) => played.reduce((sum, r) => {
        const pos = r.positions[id];
        return sum + (pos ? RACE_POINTS[pos - 1] ?? 0 : 0);
      }, 0);
      const lastPos = (id: string) => played[played.length - 1]?.positions[id] ?? 99;
      ordered = [...chosen].sort((a, b) => points(b.id) - points(a.id) || lastPos(a.id) - lastPos(b.id));
    } else {
      ordered = [...chosen].sort((a, b) => b.rating - a.rating);
    }
    setSlots(
      Array.from({ length: 24 }, (_, i) => ({
        position: i + 1,
        playerIds: ordered[i] ? [ordered[i].id] : [],
      }))
    );
    setStep(3);
  }, [players, selected, recordRaces, races]);

  const submit = async (): Promise<boolean> => {
    const results = slots.flatMap((s) =>
      s.playerIds.map((id) => ({ player_id: id, position: s.position }))
    );

    if (results.length === 0) {
      setSubmitError("Place at least one player before submitting.");
      return false;
    }

    const racePayload: RaceSubmission[] | undefined = recordRaces
      ? races.map((r) => ({
          track_id: r.trackId ?? "",
          finishes: Object.entries(r.positions).map(([player_id, position]) => ({ player_id, position })),
        }))
      : undefined;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.matches.submit(results, racePayload);

      // DB is fully committed at this point. Push winner(s) to the dashboard immediately
      // via Supabase broadcast — no polling lag, no dependency on postgres_changes.
      const winnerSlot = slots
        .filter((s) => s.playerIds.length > 0)
        .sort((a, b) => a.position - b.position)[0];
      const winners = (winnerSlot?.playerIds ?? [])
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => p !== null)
        .map(({ name, character_avatar, avatar_url }) => ({ name, character_avatar, avatar_url }));
      if (winners.length > 0) {
        const supabase = getSupabase();
        const ch = supabase.channel("leaderboard-live");
        ch.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.send({
              type: "broadcast",
              event: "gp_submitted",
              payload: { winners },
            });
            supabase.removeChannel(ch);
          }
        });
      }

      setLastResults(slots.filter((s) => s.playerIds.length > 0));
      setRaces([]);
      setRaceIndex(0);
      setStep(4);
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Same racers and final order; races (if recorded) start fresh.
  const rematch = useCallback(() => {
    setSlots(
      Array.from({ length: 24 }, (_, i) => {
        const last = lastResults.find((s) => s.position === i + 1);
        return { position: i + 1, playerIds: last?.playerIds ?? [] };
      })
    );
    if (recordRaces) {
      setSelected(new Set(lastResults.flatMap((s) => s.playerIds)));
      setRaces(Array.from({ length: DEFAULT_RACES }, emptyRace));
      setRaceIndex(0);
      setStep(2);
    } else {
      setStep(3);
    }
  }, [lastResults, recordRaces]);

  const reset = () => {
    setSelected(new Set());
    setSlots(emptySlots());
    setLastResults([]);
    setRaces([]);
    setRaceIndex(0);
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
    recordRaces, setRecordRaces,
    races, raceIndex, setRaceIndex, tracks,
    startRaces, setRaceTrack, setRacePosition, setRaceCount,
  };
}
