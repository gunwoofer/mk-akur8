"use client";

import { useState } from "react";
import { api } from "@/lib/api";

// Only same-site paths, so the login can't be used to bounce people to another site.
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
}

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.auth.login(code);
      window.location.replace(nextPath());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh max-w-md mx-auto px-6">
      <div className="w-12 h-12 rounded-2xl bg-[#00d4ff]/10 flex items-center justify-center text-2xl mb-4">🔒</div>
      <p className="text-white font-bold text-lg leading-none">MK Akur8</p>
      <p className="text-[#00d4ff] text-[10px] tracking-widest uppercase mt-1 mb-8">Admin</p>

      <form onSubmit={submit} className="w-full">
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Admin code"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="current-password"
          className="w-full bg-[#1a1a1a] border border-[#252525] rounded-xl px-4 py-3 text-white text-base placeholder-gray-700 focus:outline-none focus:border-[#00d4ff]/40"
        />
        {error && <p className="text-[#f87171] text-sm mt-2">{error}</p>}
        <button
          type="submit"
          disabled={!code.trim() || busy}
          className="w-full mt-3 py-3.5 bg-[#00d4ff] text-black font-bold text-sm rounded-2xl disabled:opacity-30"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
      <p className="text-gray-600 text-xs mt-6 text-center">You stay signed in on this phone for 90 days.</p>
    </div>
  );
}
