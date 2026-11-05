"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PlayerTrackStats, TrackLine } from "@/types";

export default function PlayerTracks({ playerId, mobile }: { playerId: string; mobile: boolean }) {
  const [stats, setStats] = useState<PlayerTrackStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.players.trackStats(playerId).then(setStats).catch(() => setFailed(true));
  }, [playerId]);

  if (failed) return <p className="text-[#f87171] text-sm py-8 text-center">Couldn&apos;t load track stats.</p>;
  if (!stats) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#ffd400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const highlights = [
    { label: "🏆 Best track", line: stats.best },
    { label: "💀 Nightmare track", line: stats.worst },
    { label: "🔁 Most played", line: stats.most_played },
  ].filter((h): h is { label: string; line: TrackLine } => h.line !== null);

  if (stats.races === 0) {
    return (
      <p className="text-[#9ca3af] text-sm py-10 text-center leading-relaxed">
        No race details yet.<br />
        <span className="text-[#6b7280]">Turn on “Record each race” when submitting a GP.</span>
      </p>
    );
  }

  return (
    <>
      {highlights.length > 0 && (
        <div className={`grid gap-2 ${mobile ? "grid-cols-1" : highlights.length === 1 ? "grid-cols-1" : highlights.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {highlights.map(({ label, line }) => <Highlight key={label} label={label} line={line} />)}
        </div>
      )}
      {!stats.best && (
        <p className="text-[#6b7280] text-xs mt-2">
          🏆 Best and 💀 nightmare tracks show up after {stats.min_races} races on the same track.
        </p>
      )}
      <div className="mb-5" />

      <p className="text-[#9ca3af] text-xs uppercase tracking-widest mb-2">Every track</p>
      <div className="space-y-1.5">
        {stats.tracks.map((l) => (
          <div key={l.track.id} className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
            <img src={l.track.image} alt="" className="w-20 h-11 object-cover shrink-0" />
            <p className="flex-1 min-w-0 text-white text-sm font-semibold truncate px-3">{l.track.name}</p>
            <span className="text-[#9ca3af] text-xs tabular-nums w-16 text-right shrink-0">{l.races} race{l.races !== 1 ? "s" : ""}</span>
            <span className="font-racing text-[#ffd400] text-base tabular-nums w-14 text-right shrink-0">P{l.avg_finish}</span>
            <span className="text-[#cbd5e1] text-xs tabular-nums w-12 text-right pr-3 shrink-0">{l.wins > 0 ? `🏆${l.wins}` : ""}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Highlight({ label, line }: { label: string; line: TrackLine }) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10 h-28">
      <img src={line.track.image} alt="" className="absolute w-full h-full object-cover" style={{ top: 0, left: 0 }} />
      <div className="absolute" style={{ top: 0, right: 0, bottom: 0, left: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.25))" }} />
      <div className="absolute" style={{ left: 12, right: 12, bottom: 10 }}>
        <p className="text-[#cbd5e1] text-[11px] uppercase tracking-widest">{label}</p>
        <p className="font-racing text-white text-base leading-tight truncate">{line.track.name}</p>
        <p className="text-[#ffd400] text-xs tabular-nums">avg P{line.avg_finish} · {line.races} race{line.races !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}
