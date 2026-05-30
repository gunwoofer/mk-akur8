"use client";

import { useState } from "react";
import PlayersTab from "@/components/admin/PlayersTab";
import SubmitTab from "@/components/admin/SubmitTab";
import ResultsTab from "@/components/admin/ResultsTab";

type Tab = "submit" | "players" | "results";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "submit", label: "Submit", icon: "🏁" },
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
    const res = await fetch("/api/seed", { method: "POST" });
    const d = await res.json();
    setSeedMsg(res.ok ? "✓ Seeded!" : `✗ ${d.error}`);
    setSeeding(false);
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#121212] border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <div className="flex-1">
            <h1 className="text-white font-bold text-base leading-none">MK Akur8</h1>
            <p className="text-[#00d4ff] text-xs tracking-wider uppercase">Admin Portal</p>
          </div>
          <button
            onClick={runSeed}
            disabled={seeding}
            className="text-xs text-gray-700 hover:text-gray-400 transition-colors disabled:opacity-50 border border-[#2a2a2a] rounded-lg px-2 py-1"
            title="Seed 5 sample players + 10 GPs"
          >
            {seeding ? "…" : "Seed"}
          </button>
        </div>
        {seedMsg && (
          <p className={`text-xs mt-1 ${seedMsg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
            {seedMsg}
          </p>
        )}
      </header>

      {/* Tab Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === "submit" && <SubmitTab />}
        {activeTab === "players" && <PlayersTab />}
        {activeTab === "results" && <ResultsTab />}
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 bg-[#121212] border-t border-[#2a2a2a] flex">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[#00d4ff]"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#00d4ff] rounded-t-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
