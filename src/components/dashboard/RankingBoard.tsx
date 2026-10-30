"use client";

import { motion, AnimatePresence } from "framer-motion";
import AvatarDisplay from "@/components/AvatarDisplay";

export interface BoardEntry {
  id: string;
  name: string;
  character_avatar: string;
  avatar_url?: string | null;
  rating: number;
  gp: number;
  rankDelta: number;
  streak?: number;
  wins: number;
}

const MK_RED = "#e60012";
const MK_YELLOW = "#ffd400";

const PLACE = {
  1: { label: "1ST", ring: "#ffd400", step: "linear-gradient(180deg, #fff3a0 0%, #ffd400 35%, #d98a00 100%)", height: 56, avatar: 80 },
  2: { label: "2ND", ring: "#d9dde3", step: "linear-gradient(180deg, #ffffff 0%, #cfd4da 35%, #8d949e 100%)", height: 40, avatar: 60 },
  3: { label: "3RD", ring: "#e8893c", step: "linear-gradient(180deg, #ffd2a6 0%, #e8893c 35%, #9a4a12 100%)", height: 28, avatar: 60 },
} as const;

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "TH" : ["TH", "ST", "ND", "RD"][n % 10] ?? "TH";
  return s;
}

export const ROW_GRID = "grid grid-cols-[5rem_3rem_1fr_7rem_4rem_4rem_6rem] gap-4 items-center";

export function TrophyBadge({ wins }: { wins: number }) {
  if (wins === 0) return null;
  if (wins <= 5) return <span className="text-sm leading-none shrink-0">{"🏆".repeat(wins)}</span>;
  return <span className="text-yellow-400 text-sm font-bold leading-none shrink-0">🏆×{wins}</span>;
}

function Trend({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-[#4ade80] text-lg font-bold">▲</span>;
  if (delta < 0) return <span className="text-[#f87171] text-lg font-bold">▼</span>;
  return null;
}

function PodiumSpot({ entry, place, onOpen }: { entry: BoardEntry; place: 1 | 2 | 3; onOpen: (id: string) => void }) {
  const p = PLACE[place];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: place === 1 ? 0.15 : 0 }}
      onClick={() => onOpen(entry.id)}
      className="w-56 mx-3 flex flex-col items-center cursor-pointer"
    >
      <div className="relative mb-2">
        {place === 1 && (
          <span className="absolute text-3xl leading-none" style={{ left: "50%", top: -28, transform: "translateX(-50%)" }}>👑</span>
        )}
        <div
          className="rounded-full overflow-hidden flex items-center justify-center bg-black/60"
          style={{ width: p.avatar, height: p.avatar, border: `4px solid ${p.ring}`, boxShadow: `0 0 18px ${p.ring}66` }}
        >
          <AvatarDisplay
            avatarUrl={entry.avatar_url}
            characterAvatar={entry.character_avatar}
            imgClassName="w-full h-full"
            emojiClassName={place === 1 ? "text-5xl" : "text-4xl"}
          />
        </div>
      </div>
      <div className="flex items-center max-w-full">
        <p className={`font-racing text-outline text-white uppercase truncate ${place === 1 ? "text-2xl" : "text-xl"}`}>
          {entry.name}
        </p>
        {entry.streak !== undefined && (
          <span className="ml-2 shrink-0 text-orange-400 font-bold text-base leading-none">🔥{entry.streak}</span>
        )}
      </div>
      <div className="flex items-center mb-2">
        <p className={`font-racing text-outline tabular-nums ${place === 1 ? "text-3xl" : "text-2xl"}`} style={{ color: MK_YELLOW }}>
          {entry.rating.toFixed(2)}
        </p>
        <span className="ml-2"><Trend delta={entry.rankDelta} /></span>
        {entry.wins > 0 && <span className="ml-2"><TrophyBadge wins={entry.wins} /></span>}
      </div>
      <div
        className="w-full rounded-t-lg flex items-center justify-center border-t-2 border-white/60"
        style={{ height: p.height, background: p.step, boxShadow: "0 6px 18px rgba(0,0,0,0.5)" }}
      >
        <span
          className="font-racing leading-none"
          style={{ color: "#1a1206", fontSize: place === 1 ? 30 : 24, textShadow: "0 1px 0 rgba(255,255,255,0.6)" }}
        >
          {p.label}
        </span>
      </div>
    </motion.div>
  );
}

export function Podium({ entries, onOpen }: { entries: BoardEntry[]; onOpen: (id: string) => void }) {
  const [first, second, third] = entries;
  if (!first) return null;
  return (
    <div className="flex items-end justify-center mb-5 shrink-0 pt-7">
      {second && <PodiumSpot key={second.id} entry={second} place={2} onOpen={onOpen} />}
      <PodiumSpot key={first.id} entry={first} place={1} onOpen={onOpen} />
      {third && <PodiumSpot key={third.id} entry={third} place={3} onOpen={onOpen} />}
    </div>
  );
}

export function ColumnHeaders() {
  const label = "text-[#cbd5e1] text-xs font-semibold uppercase tracking-wider";
  return (
    <div className={`${ROW_GRID} px-6 mb-2 shrink-0`}>
      <span className={label}>Pos</span>
      <span />
      <span className={label}>Player</span>
      <span className={`${label} text-right`}>Rating</span>
      <span className={`${label} text-right`}>GPs</span>
      <span className={`${label} text-right`}>Trend</span>
      <span className={`${label} text-right`}>Seasons won</span>
    </div>
  );
}

function BoardRow({ entry, rank, onOpen }: { entry: BoardEntry; rank: number; onOpen: (id: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={() => onOpen(entry.id)}
      className={`hud-row ${ROW_GRID} px-6 py-2.5 mb-2 cursor-pointer`}
      style={{ ["--hud-accent" as string]: MK_RED }}
    >
      <span className="font-racing text-outline text-white leading-none">
        <span className="text-3xl tabular-nums">{rank}</span>
        <span className="text-sm ml-0.5 align-top">{ordinal(rank)}</span>
      </span>
      <AvatarDisplay avatarUrl={entry.avatar_url} characterAvatar={entry.character_avatar} imgClassName="w-9 h-9" emojiClassName="text-3xl" />
      <div className="min-w-0 flex items-center">
        <p className="font-racing text-outline text-white text-xl uppercase truncate leading-tight mr-2">
          {entry.name}
        </p>
        {entry.streak !== undefined && (
          <span className="shrink-0 text-orange-400 font-bold text-lg leading-none">🔥{entry.streak}</span>
        )}
      </div>
      <p className="font-racing text-outline text-2xl tabular-nums text-right" style={{ color: MK_YELLOW }}>
        {entry.rating.toFixed(2)}
      </p>
      <p className="text-[#cbd5e1] text-sm tabular-nums text-right">{entry.gp}</p>
      <div className="flex justify-end items-center"><Trend delta={entry.rankDelta} /></div>
      <div className="flex justify-end"><TrophyBadge wins={entry.wins} /></div>
    </motion.div>
  );
}

export function RankingBoard({ entries, onOpen }: { entries: BoardEntry[]; onOpen: (id: string) => void }) {
  return (
    <>
      <Podium entries={entries.slice(0, 3)} onOpen={onOpen} />
      {entries.length > 3 && <ColumnHeaders />}
      <div className="flex-1 overflow-y-auto scrollbar-hide pl-3">
        <AnimatePresence mode="popLayout">
          {entries.slice(3).map((entry, i) => (
            <BoardRow key={entry.id} entry={entry} rank={i + 4} onOpen={onOpen} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
