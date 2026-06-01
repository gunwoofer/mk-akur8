"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import PlayersTab from "@/components/admin/PlayersTab";
import SubmitTab from "@/components/admin/SubmitTab";
import ResultsTab from "@/components/admin/ResultsTab";

type Tab = "submit" | "players" | "results";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "submit",  label: "Submit",  icon: "🏁" },
  { id: "players", label: "Players", icon: "👥" },
  { id: "results", label: "Results", icon: "📊" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("submit");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  async function runSeed() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      await api.seed.run();
      setSeedMsg("✓ Seeded");
    } catch (err) {
      setSeedMsg(`✗ ${err instanceof Error ? err.message : "Failed"}`);
    } finally {
      setSeeding(false);
      setTimeout(() => setSeedMsg(null), 3000);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto overflow-hidden">
      {/* Header */}
      <header className="shrink-0 px-4 pt-4 pb-3 border-b border-[#181818]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00d4ff]/10 flex items-center justify-center text-base">
            🎮
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm leading-none">MK Akur8</p>
            <p className="text-[#00d4ff] text-[10px] tracking-widest uppercase mt-0.5">Admin</p>
          </div>
          <AnimatePresence>
            {seedMsg && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`text-xs font-medium ${seedMsg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}
              >
                {seedMsg}
              </motion.span>
            )}
          </AnimatePresence>
          <button
            onClick={runSeed}
            disabled={seeding}
            className="text-[11px] text-gray-700 hover:text-gray-400 transition-colors disabled:opacity-40 px-2.5 py-1.5 rounded-lg border border-[#1f1f1f] bg-[#141414]"
          >
            {seeding ? "…" : "Seed"}
          </button>
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: [0.25, 0, 0.2, 1] }}
          >
            {activeTab === "submit"  && <SubmitTab />}
            {activeTab === "players" && <PlayersTab />}
            {activeTab === "results" && <ResultsTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom nav */}
      <nav className="shrink-0 flex items-stretch gap-1 px-2 pt-1.5 pb-2 border-t border-[#181818]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-colors"
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 bg-[#1a1a1a] rounded-xl"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative text-lg leading-none">{tab.icon}</span>
            <span className={`relative text-[10px] font-semibold transition-colors ${
              activeTab === tab.id ? "text-[#00d4ff]" : "text-gray-600"
            }`}>
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
