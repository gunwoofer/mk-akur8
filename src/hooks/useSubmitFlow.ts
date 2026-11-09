"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { RACE_POINTS } from "@/lib/tracks";
import type { Player, RaceSubmission, Track } from "@/types";

// 1 Lobby → 2 Races (only when recording races) → 3 Final ranking → 4 Done
export type Step = 1 | 2 | 3 | 4;

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
  ranking?: Record<string, number>;   // final ranking entered so far (step 3)
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
  // Final GP position of each racer; several racers may share one.
  const [ranking, setRanking] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Pick a GP in progress back up after the phone locked or the page reloaded — between races
  // or on the final ranking.
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
    if (draft.step === 3 && draft.ranking) {
      setRanking(Object.fromEntries(Object.entries(draft.ranking).filter(([id]) => ids.includes(id))));
      setStep(3);
    } else {
      setStep(2);
    }
  }, [loadingPlayers, draftRestored, players]);

  // Kept until the GP is submitted (step 4) or the flow goes back to the lobby.
  useEffect(() => {
    if (!draftRestored) return;
    const inProgress = recordRaces && (step === 2 || step === 3);
    writeDraft(inProgress
      ? { selected: [...selected], races, raceIndex, step, ...(step === 3 ? { ranking } : {}) }
      : null);
  }, [draftRestored, recordRaces, step, selected, races, raceIndex, ranking]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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

  // With recorded races: pre-filled 1…N by total race points (Mario Kart World scale),
  // ties to the better last race. Without: left empty — a guessed order is easy to submit by mistake.
  const goToPositions = useCallback(() => {
    const chosen = players.filter((p) => selected.has(p.id));
    const played = races.filter((r) => r.trackId !== null);
    if (recordRaces && played.length > 0) {
      const points = (id: string) => played.reduce((sum, r) => {
        const pos = r.positions[id];
        return sum + (pos ? RACE_POINTS[pos - 1] ?? 0 : 0);
      }, 0);
      const lastPos = (id: string) => played[played.length - 1]?.positions[id] ?? 99;
      const ordered = [...chosen].sort((a, b) => points(b.id) - points(a.id) || lastPos(a.id) - lastPos(b.id));
      setRanking(Object.fromEntries(ordered.map((p, i) => [p.id, i + 1])));
    } else {
      setRanking({});
    }
    setStep(3);
  }, [players, selected, recordRaces, races]);

  const setFinalPosition = (playerId: string, position: number | null) =>
    setRanking((prev) => {
      const next = { ...prev };
      if (position === null) delete next[playerId];
      else next[playerId] = position;
      return next;
    });

  const submit = async (): Promise<boolean> => {
    const results = [...selected].map((id) => ({ player_id: id, position: ranking[id] }));
    if (results.length === 0 || results.some((r) => r.position === undefined)) {
      setSubmitError("Give every racer a position before submitting.");
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
      const best = Math.min(...results.map((r) => r.position));
      const winners = results.filter((r) => r.position === best)
        .map((r) => players.find((p) => p.id === r.player_id))
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

  // Same racers; positions (and races, if recorded) start fresh.
  const rematch = useCallback(() => {
    setRanking({});
    setSubmitError(null);
    if (recordRaces) {
      setRaces(Array.from({ length: DEFAULT_RACES }, emptyRace));
      setRaceIndex(0);
      setStep(2);
    } else {
      setStep(3);
    }
  }, [recordRaces]);

  const reset = () => {
    setSelected(new Set());
    setRanking({});
    setRaces([]);
    setRaceIndex(0);
    setStep(1);
    setSubmitError(null);
  };

  return {
    step, setStep, goToPositions,
    players, loadingPlayers, fetchError,
    selected, toggleSelect,
    ranking, setFinalPosition,
    submitting, submitError,
    submit, reset, rematch,
    recordRaces, setRecordRaces,
    races, raceIndex, setRaceIndex, tracks,
    startRaces, setRaceTrack, setRacePosition, setRaceCount,
  };
}
