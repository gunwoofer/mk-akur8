"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import AvatarDisplay from "@/components/AvatarDisplay";
import GPDetails, { formatGPDate } from "@/components/GPDetails";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { HistoryEntry } from "@/types";

const PAGE_SIZE = 10;
const ACCENT = "#ffd400";

export default function GPHistoryModal({ onClose }: { onClose: () => void }) {
  const mobile = useIsMobile();
  const [gps, setGps] = useState<HistoryEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const loadingRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);

  const loadMore = useCallback(async (offset: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const page = await api.history.list({ limit: PAGE_SIZE, offset });
      setGps((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.history.list({ limit: PAGE_SIZE, offset: 0 })
      .then((page) => { setGps(page); setHasMore(page.length === PAGE_SIZE); })
      .catch(() => setFailed(true))
      .finally(() => { loadingRef.current = false; setLoading(false); });
  }, []);

  // Scroll events rather than IntersectionObserver, which the TV's iOS 12 iPad may lack.
  function onScroll() {
    const el = scrollRef.current;
    if (!el || selected || !hasMore || failed) return;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 300) loadMore(gps.length);
  }

  function open(gp: HistoryEntry) {
    listScroll.current = scrollRef.current?.scrollTop ?? 0;
    setSelected(gp);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  function back() {
    setSelected(null);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = listScroll.current;
    });
  }

  const navButton = "w-9 h-9 rounded-full flex items-center justify-center border border-white/10 bg-black/40 text-white";

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
          <div className="flex items-center min-w-0">
            {selected && <button onClick={back} aria-label="All GPs" className={`${navButton} mr-3 shrink-0`}>‹</button>}
            <div className="min-w-0">
              <h2 className={`font-racing mk-title leading-none ${mobile ? "text-3xl" : "text-4xl"}`}>{selected ? "GP Details" : "Last GPs"}</h2>
              <p className="text-[#9ca3af] text-xs mt-1 truncate">{selected ? formatGPDate(selected.played_at) : "Tap a GP to see every race"}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={`${navButton} shrink-0 ml-3`}>✕</button>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className={`overflow-y-auto flex-1 min-h-0 ${mobile ? "px-4 pb-4" : "px-7 pb-6"}`}>
          {selected ? (
            <GPDetails matchId={selected.match_id} mobile={mobile} accent={ACCENT} />
          ) : (
            <>
              {gps.length === 0 && !loading && !hasMore && (
                <p className="text-[#9ca3af] text-sm py-10 text-center">No GP played yet.</p>
              )}
              <div className="space-y-1.5">
                {gps.map((gp) => <GPRow key={gp.match_id} gp={gp} mobile={mobile} onOpen={() => open(gp)} />)}
              </div>
              <div className="py-4 flex justify-center">
                {loading ? (
                  <div className="w-6 h-6 border-2 border-[#ffd400] border-t-transparent rounded-full animate-spin" />
                ) : failed ? (
                  <button onClick={() => loadMore(gps.length)} className="text-[#f87171] text-sm">Couldn&apos;t load · retry</button>
                ) : hasMore ? (
                  <button onClick={() => loadMore(gps.length)} className="px-4 py-1.5 rounded-lg border border-white/15 bg-black/50 text-[#e5e7eb] text-xs font-semibold uppercase tracking-wider">
                    Load more
                  </button>
                ) : gps.length > 0 ? (
                  <p className="text-[#6b7280] text-xs">That&apos;s every GP · {gps.length}</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function GPRow({ gp, mobile, onOpen }: { gp: HistoryEntry; mobile: boolean; onOpen: () => void }) {
  const shared = (pos: number) => gp.results.filter((r) => r.position === pos).length > 1;
  return (
    <button onClick={onOpen} className="w-full text-left rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5" style={{ WebkitTapHighlightColor: "transparent" }}>
      <div className="flex items-center">
        <p className="flex-1 min-w-0 text-[#cbd5e1] text-xs truncate">{formatGPDate(gp.played_at)}</p>
        {gp.tracks.length > 0 && (
          <div className="flex items-center shrink-0 ml-2">
            {gp.tracks.slice(0, mobile ? 4 : 6).map((t, i) => (
              <img key={i} src={t.image} alt={t.name} title={t.name} className={`${mobile ? "w-8 h-5" : "w-11 h-6"} object-cover rounded ml-1`} />
            ))}
          </div>
        )}
        <span className="text-[#6b7280] text-lg ml-2 shrink-0">›</span>
      </div>
      <div className="flex flex-wrap items-center mt-1.5">
        {gp.results.map((r) => (
          <span key={r.player_id} className="flex items-center mr-3 mb-0.5 text-sm">
            <span className="font-racing tabular-nums mr-1" style={{ color: r.position <= 3 ? ACCENT : "#6b7280" }}>
              {r.position === 1 && !shared(1) ? "🥇" : `${shared(r.position) ? "=" : "P"}${r.position}`}
            </span>
            <AvatarDisplay avatarUrl={r.avatar_url} characterAvatar={r.avatar} imgClassName="w-5 h-5 mr-1" emojiClassName="text-base mr-1" />
            <span className="text-white font-semibold">{r.name}</span>
          </span>
        ))}
      </div>
    </button>
  );
}
