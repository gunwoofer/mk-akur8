"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Player, Track } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";
import { isRaceComplete, MAX_RACES, MIN_RACES, type RaceDraft } from "@/hooks/useSubmitFlow";

interface Props {
  racers: Player[];
  tracks: Track[];
  races: RaceDraft[];
  raceIndex: number;
  onSelectRace: (index: number) => void;
  onSetTrack: (index: number, trackId: string | null) => void;
  onSetPosition: (index: number, playerId: string, position: number | null) => void;
  onSetRaceCount: (count: number) => void;
  onBack: () => void;
  onFinish: () => void;
}

type KindFilter = "all" | "main" | "snes";

export default function RacesStep({
  racers, tracks, races, raceIndex,
  onSelectRace, onSetTrack, onSetPosition, onSetRaceCount, onBack, onFinish,
}: Props) {
  const race = races[raceIndex];
  const racerIds = racers.map((p) => p.id);
  const complete = race ? isRaceComplete(race, racerIds) : false;
  const allComplete = races.every((r) => isRaceComplete(r, racerIds));
  const isLast = raceIndex === races.length - 1;
  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const track = race?.trackId ? trackById.get(race.trackId) ?? null : null;

  // Mounted once per race (key={raceIndex}): open the track picker if the race has no
  // track yet, otherwise the first racer still missing a position.
  const [picking, setPicking] = useState(!track);
  const [activePlayer, setActivePlayer] = useState<string | null>(() =>
    race?.trackId ? racerIds.find((id) => race.positions[id] === undefined) ?? null : null);

  if (!race) return null;

  const pickTrack = (id: string) => {
    onSetTrack(raceIndex, id);
    setPicking(false);
    setActivePlayer(racerIds.find((pid) => race.positions[pid] === undefined) ?? null);
  };

  const pickPosition = (playerId: string, position: number) => {
    onSetPosition(raceIndex, playerId, race.positions[playerId] === position ? null : position);
    const next = racerIds.find((id) => id !== playerId && race.positions[id] === undefined);
    setActivePlayer(next ?? null);
  };

  return (
    <div className="px-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-1 pb-3">
        <button onClick={onBack} className="text-gray-500 text-sm">← Lobby</button>
        <div className="flex items-center">
          <button
            onClick={() => onSetRaceCount(races.length - 1)}
            disabled={races.length <= Math.max(MIN_RACES, raceIndex + 1)}
            className="w-7 h-7 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white disabled:opacity-30"
            aria-label="One race less"
          >−</button>
          <span className="text-gray-400 text-xs mx-2 tabular-nums">{races.length} races</span>
          <button
            onClick={() => onSetRaceCount(races.length + 1)}
            disabled={races.length >= MAX_RACES}
            className="w-7 h-7 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white disabled:opacity-30"
            aria-label="One race more"
          >+</button>
        </div>
      </div>

      {/* Race chips */}
      <div className="flex mb-4">
        {races.map((r, i) => {
          const done = isRaceComplete(r, racerIds);
          const current = i === raceIndex;
          return (
            <button
              key={i}
              onClick={() => onSelectRace(i)}
              className={`flex-1 mr-1.5 last:mr-0 py-2 rounded-xl text-xs font-bold border transition-colors ${
                current ? "bg-[#00d4ff] text-black border-[#00d4ff]"
                  : done ? "bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/30"
                  : "bg-[#141414] text-gray-500 border-[#1e1e1e]"
              }`}
            >
              {done && !current ? "✓ " : ""}R{i + 1}
            </button>
          );
        })}
      </div>

      <h2 className="text-white font-bold text-lg leading-none mb-3">Race {raceIndex + 1} / {races.length}</h2>

      {/* Track */}
      {picking || !track ? (
        <TrackPicker
          tracks={tracks}
          usedIn={races.map((r, i) => (i !== raceIndex ? r.trackId : null))}
          selectedId={race.trackId}
          onPick={pickTrack}
          onCancel={track ? () => setPicking(false) : undefined}
        />
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="relative w-full h-28 rounded-2xl overflow-hidden border border-[#2a2a2a] mb-4 text-left"
        >
          <img src={track.image} alt="" className="absolute w-full h-full object-cover" style={{ top: 0, left: 0 }} />
          <div className="absolute" style={{ left: 0, right: 0, bottom: 0, top: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0) 60%)" }} />
          <div className="absolute flex items-end justify-between" style={{ left: 12, right: 12, bottom: 10 }}>
            <p className="text-white font-bold text-base">{track.name}</p>
            <span className="text-[#00d4ff] text-xs font-semibold">Change</span>
          </div>
        </button>
      )}

      {/* Positions */}
      {track && !picking && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Finish position (1–24)</p>
          {racers.map((p) => {
            const pos = race.positions[p.id];
            const open = activePlayer === p.id;
            const takenByOthers = new Set(
              Object.entries(race.positions).filter(([id]) => id !== p.id).map(([, v]) => v));
            return (
              <div key={p.id} className="rounded-2xl border border-[#1e1e1e] bg-[#141414] overflow-hidden">
                <button
                  onClick={() => setActivePlayer(open ? null : p.id)}
                  className="w-full flex items-center px-4 py-3 text-left"
                >
                  <AvatarDisplay avatarUrl={p.avatar_url} characterAvatar={p.character_avatar} imgClassName="w-8 h-8 mr-3" emojiClassName="text-2xl mr-3" />
                  <span className="flex-1 text-white text-sm font-semibold truncate">{p.name}</span>
                  <span className={`min-w-[3rem] text-center rounded-lg px-2 py-1 text-sm font-black tabular-nums ${
                    pos ? "bg-[#00d4ff] text-black" : open ? "bg-[#00d4ff]/15 text-[#00d4ff]" : "bg-[#1f1f1f] text-gray-600"
                  }`}>
                    {pos ? `P${pos}` : "–"}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="grid grid-cols-6 gap-1.5 px-3 pb-3">
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => {
                          const taken = takenByOthers.has(n);
                          return (
                            <button
                              key={n}
                              onClick={() => pickPosition(p.id, n)}
                              className={`py-2.5 rounded-lg text-sm font-bold tabular-nums ${
                                pos === n ? "bg-[#00d4ff] text-black"
                                  : taken ? "bg-[#111] text-gray-700"
                                  : n <= 12 ? "bg-[#1f1f1f] text-white active:bg-[#2a2a2a]"
                                  : "bg-[#181818] text-gray-400 active:bg-[#2a2a2a]"
                              }`}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="sticky bottom-0 bg-[#0a0a0a] pt-3 pb-1 mt-3">
        {!isLast ? (
          <div className="flex">
            <motion.button
              onClick={() => onSelectRace(raceIndex + 1)}
              disabled={!complete}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-3.5 bg-[#00d4ff] text-black font-bold text-sm rounded-2xl disabled:opacity-30"
            >
              {complete ? `Next race →` : track ? "Set every position" : "Pick the track"}
            </motion.button>
          </div>
        ) : (
          <motion.button
            onClick={onFinish}
            disabled={!allComplete}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 bg-[#00d4ff] text-black font-bold text-sm rounded-2xl disabled:opacity-30"
          >
            {allComplete ? "Final ranking →" : complete ? "Some races are incomplete" : track ? "Set every position" : "Pick the track"}
          </motion.button>
        )}
      </div>
    </div>
  );
}

function TrackPicker({
  tracks, usedIn, selectedId, onPick, onCancel,
}: {
  tracks: Track[];
  usedIn: (string | null)[];
  selectedId: string | null;
  onPick: (id: string) => void;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");

  const shown = tracks.filter((t) =>
    (kind === "all" || t.kind === kind) && t.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="mb-4">
      <div className="flex items-center mb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a track"
          className="flex-1 bg-[#1a1a1a] border border-[#252525] rounded-xl px-3 py-2.5 text-white text-base placeholder-gray-700 focus:outline-none focus:border-[#00d4ff]/40"
        />
        {onCancel && (
          <button onClick={onCancel} className="ml-2 text-gray-500 text-sm px-2">Cancel</button>
        )}
      </div>
      <div className="flex mb-3">
        {(["all", "main", "snes"] as KindFilter[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`mr-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              kind === k ? "bg-[#00d4ff] text-black" : "bg-[#1a1a1a] text-gray-500"
            }`}
          >
            {k === "all" ? "All" : k === "main" ? "Main" : "SNES"}
          </button>
        ))}
      </div>
      {tracks.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {shown.map((t) => {
            const usedAt = usedIn.indexOf(t.id);
            return (
              <button
                key={t.id}
                onClick={() => onPick(t.id)}
                className={`relative rounded-xl overflow-hidden border text-left ${
                  t.id === selectedId ? "border-[#00d4ff]" : "border-[#1e1e1e]"
                } ${usedAt >= 0 ? "opacity-40" : ""}`}
              >
                <img src={t.image} alt="" className="w-full h-20 object-cover" />
                {usedAt >= 0 && (
                  <span className="absolute bg-black/80 text-white text-[10px] font-bold rounded px-1.5 py-0.5" style={{ top: 6, left: 6 }}>
                    R{usedAt + 1}
                  </span>
                )}
                <p className="text-white text-xs font-semibold px-2 py-1.5 truncate bg-[#141414]">{t.name}</p>
              </button>
            );
          })}
          {shown.length === 0 && <p className="col-span-2 text-gray-600 text-sm text-center py-6">No track found.</p>}
        </div>
      )}
    </div>
  );
}
