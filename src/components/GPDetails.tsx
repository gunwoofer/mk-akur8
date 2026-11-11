"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatSeasonDelta } from "@/lib/format";
import AvatarDisplay from "@/components/AvatarDisplay";
import type { GPDetail, GPDetailPlayer, SeasonKind } from "@/types";

export function formatGPDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Montreal", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function positionLabel(position: number, shared: boolean): string {
  if (position === 1 && !shared) return "🥇";
  return `${shared ? "=" : "P"}${position}`;
}

function Delta({ value, kind, label }: { value: number | null; kind: SeasonKind; label: string }) {
  if (value === null) return null;
  const rounded = kind === "elo" ? Math.round(value) : value;
  return (
    <span className="flex flex-col items-end w-14 shrink-0">
      <span className={`text-sm font-bold tabular-nums ${rounded > 0 ? "text-[#4ade80]" : rounded < 0 ? "text-[#f87171]" : "text-[#9ca3af]"}`}>
        {formatSeasonDelta(value, kind)}
      </span>
      <span className="text-[#6b7280] text-[10px] uppercase tracking-wider leading-none">{label}</span>
    </span>
  );
}

// Final ranking (with each player's Elo change) and every recorded race of one GP.
// Used by the dashboard's "Last GPs" modal and the admin history.
export default function GPDetails({ matchId, mobile, accent }: { matchId: string; mobile: boolean; accent: string }) {
  const [data, setData] = useState<GPDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api.matches.get(matchId)
      .then((d) => { if (live) setData(d); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [matchId]);

  if (failed) return <p className="text-[#f87171] text-sm py-8 text-center">Couldn&apos;t load this GP.</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const players = new Map<string, GPDetailPlayer>(data.results.map((p) => [p.player_id, p]));
  const sharedFinal = (pos: number) => data.results.filter((r) => r.position === pos).length > 1;

  return (
    <>
      <p className="text-[#9ca3af] text-xs uppercase tracking-widest mb-2">Final ranking</p>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] divide-y divide-white/5 mb-5">
        {data.results.map((r) => (
          <div key={r.player_id} className="flex items-center px-3 py-2">
            <span className="font-bold text-sm tabular-nums w-9 shrink-0" style={{ color: r.position <= 3 ? accent : "#6b7280" }}>
              {positionLabel(r.position, sharedFinal(r.position))}
            </span>
            <AvatarDisplay avatarUrl={r.avatar_url} characterAvatar={r.character_avatar} imgClassName="w-7 h-7 mr-2" emojiClassName="text-xl mr-2" />
            <span className="flex-1 min-w-0 truncate text-white text-sm font-semibold">{r.name}</span>
            <Delta value={r.season_delta} kind={r.season_kind} label="season" />
            <Delta value={r.global_delta} kind={r.global_kind} label="global" />
          </div>
        ))}
      </div>

      <p className="text-[#9ca3af] text-xs uppercase tracking-widest mb-2">
        Races{data.races.length > 0 ? ` · ${data.races.length}` : ""}
      </p>
      {data.races.length === 0 ? (
        <p className="text-[#6b7280] text-sm py-4 text-center">This GP wasn&apos;t recorded race by race.</p>
      ) : (
        <div className={`grid gap-2 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
          {data.races.map((race) => (
            <div key={race.race_number} className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
              <div className="relative h-16">
                {race.track && <img src={race.track.image} alt="" className="absolute w-full h-full object-cover" style={{ top: 0, left: 0 }} />}
                <div className="absolute" style={{ top: 0, right: 0, bottom: 0, left: 0, background: "linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.2))" }} />
                <div className="absolute" style={{ left: 12, right: 12, bottom: 8 }}>
                  <p className="text-[#cbd5e1] text-[10px] uppercase tracking-widest leading-none">Race {race.race_number}</p>
                  <p className="text-white text-sm font-bold truncate mt-1">{race.track?.name ?? "Unknown track"}</p>
                </div>
              </div>
              <div className="px-3 py-1.5">
                {race.finishes.map((f) => {
                  const p = players.get(f.player_id);
                  return (
                    <div key={f.player_id} className="flex items-center py-0.5 text-sm">
                      <span className="font-bold tabular-nums w-9 shrink-0" style={{ color: f.position <= 3 ? accent : "#6b7280" }}>
                        {f.position === 1 ? "🥇" : `P${f.position}`}
                      </span>
                      {p && <AvatarDisplay avatarUrl={p.avatar_url} characterAvatar={p.character_avatar} imgClassName="w-5 h-5 mr-2" emojiClassName="text-base mr-2" />}
                      <span className="text-[#e5e7eb] truncate">{p?.name ?? "Unknown"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
