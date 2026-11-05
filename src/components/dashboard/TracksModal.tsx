"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import AvatarDisplay from "@/components/AvatarDisplay";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { TrackOverview, TracksOverview } from "@/types";

export default function TracksModal({ onClose }: { onClose: () => void }) {
  const mobile = useIsMobile();
  const [data, setData] = useState<TracksOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.tracks.overview().then(setData).catch(() => setFailed(true));
  }, []);

  const played = data?.tracks.filter((t) => t.races > 0) ?? [];
  const unplayed = data?.tracks.filter((t) => t.races === 0) ?? [];
  const byId = new Map((data?.tracks ?? []).map((t) => [t.track.id, t]));
  const hardest = data?.hardest ? byId.get(data.hardest) : undefined;
  const easiest = data?.easiest ? byId.get(data.easiest) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`fixed inset-0 z-50 flex items-center justify-center ${mobile ? "p-3" : "p-8"}`}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ scale: 0.94, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl flex flex-col overflow-hidden rounded-2xl border border-white/10 max-h-[90vh]"
        style={{ background: "linear-gradient(180deg, #17171f 0%, #101016 60%)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
      >
        <div className="checkered h-2 w-full shrink-0 opacity-80" />
        <div className="h-1 w-full shrink-0" style={{ background: "#e60012" }} />

        <div className={`flex items-center justify-between shrink-0 ${mobile ? "px-4 pt-4 pb-3" : "px-7 pt-6 pb-4"}`}>
          <div>
            <h2 className={`font-racing mk-title leading-none ${mobile ? "text-3xl" : "text-4xl"}`}>Tracks</h2>
            <p className="text-[#9ca3af] text-xs mt-1">From GPs recorded race by race</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#9ca3af] border border-white/10 bg-black/40"
          >
            ✕
          </button>
        </div>

        <div className={`overflow-y-auto flex-1 min-h-0 ${mobile ? "px-4 pb-4" : "px-7 pb-6"}`}>
          {failed ? (
            <p className="text-[#f87171] text-sm py-8 text-center">Couldn&apos;t load tracks.</p>
          ) : !data ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#ffd400] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : played.length === 0 ? (
            <p className="text-[#9ca3af] text-sm py-10 text-center leading-relaxed">
              No race recorded yet.<br />
              <span className="text-[#6b7280]">Turn on “Record each race” when submitting a GP.</span>
            </p>
          ) : (
            <>
              {(hardest || easiest) && (
                <div className={`grid gap-2 mb-5 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
                  {easiest && <Spotlight label="😎 Easiest for the group" t={easiest} />}
                  {hardest && <Spotlight label="😱 Hardest for the group" t={hardest} />}
                </div>
              )}

              <p className="text-[#9ca3af] text-xs uppercase tracking-widest mb-2">
                👑 best average (min {data.min_races} races)
              </p>
              <div className="space-y-1.5 mb-5">
                {played.map((t) => (
                  <div key={t.track.id} className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
                    <img src={t.track.image} alt="" className={`${mobile ? "w-16 h-10" : "w-24 h-14"} object-cover shrink-0`} />
                    <div className="flex-1 min-w-0 px-3">
                      <p className="text-white text-sm font-semibold truncate">{t.track.name}</p>
                      <p className="text-[#9ca3af] text-xs tabular-nums">
                        {t.races} race{t.races !== 1 ? "s" : ""}{t.avg_finish !== null ? ` · group avg P${t.avg_finish}` : ""}
                      </p>
                    </div>
                    {t.king ? (
                      <div className="flex items-center pr-3 shrink-0">
                        <span className="text-base mr-1.5">👑</span>
                        <AvatarDisplay avatarUrl={t.king.avatar_url} characterAvatar={t.king.character_avatar} imgClassName="w-7 h-7" emojiClassName="text-xl" />
                        {!mobile && <span className="text-white text-sm font-semibold ml-2 max-w-[7rem] truncate">{t.king.name}</span>}
                        <span className="font-racing text-[#ffd400] text-sm tabular-nums ml-2">P{t.king.avg_finish}</span>
                      </div>
                    ) : (
                      <span className="text-[#6b7280] text-xs pr-3 shrink-0">no king yet</span>
                    )}
                  </div>
                ))}
              </div>

              {unplayed.length > 0 && (
                <>
                  <p className="text-[#9ca3af] text-xs uppercase tracking-widest mb-2">Not raced yet · {unplayed.length}</p>
                  <div className={`grid gap-1.5 ${mobile ? "grid-cols-3" : "grid-cols-5"}`}>
                    {unplayed.map((t) => (
                      <div key={t.track.id} className="rounded-lg overflow-hidden border border-white/10 opacity-60">
                        <img src={t.track.image} alt="" className="w-full h-12 object-cover" />
                        <p className="text-[#cbd5e1] text-[10px] px-1.5 py-1 truncate bg-black/40">{t.track.name}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Spotlight({ label, t }: { label: string; t: TrackOverview }) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10 h-28">
      <img src={t.track.image} alt="" className="absolute w-full h-full object-cover" style={{ top: 0, left: 0 }} />
      <div className="absolute" style={{ top: 0, right: 0, bottom: 0, left: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.2))" }} />
      <div className="absolute" style={{ left: 12, right: 12, bottom: 10 }}>
        <p className="text-[#cbd5e1] text-[11px] uppercase tracking-widest">{label}</p>
        <p className="font-racing text-white text-base leading-tight truncate">{t.track.name}</p>
        <p className="text-[#ffd400] text-xs tabular-nums">group avg P{t.avg_finish} · {t.races} races</p>
      </div>
    </div>
  );
}
