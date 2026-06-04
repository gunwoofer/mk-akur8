"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Player } from "@/types";
import AvatarDisplay from "@/components/AvatarDisplay";
import PhotoCropModal from "./PhotoCropModal";

const AVATARS = ["🏎️", "🍄", "⭐", "🦕", "🐢", "👸", "🦊", "🐸", "🐧", "🦁", "🐉", "🌸"];

export default function PlayersTab() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🏎️");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionPlayer, setActionPlayer] = useState<Player | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Persists the target player ID across state resets during the file-pick flow
  const pendingPlayerIdRef = useRef<string | null>(null);

  async function fetchPlayers() {
    setLoading(true);
    setFetchError(null);
    try {
      setPlayers(await api.players.list());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load players");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPlayers(); }, []);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await api.players.create(name.trim(), avatar);
      setName("");
      await fetchPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add player");
    } finally {
      setAdding(false);
    }
  }

  async function deletePlayer(id: string) {
    if (!confirm("Remove this player?")) return;
    try {
      await api.players.delete(id);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // non-critical
    }
  }

  function startPhotoPicker(player: Player) {
    pendingPlayerIdRef.current = player.id;
    setActionPlayer(null);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCropFile(file);
    e.target.value = "";
  }

  async function handlePhotoConfirmed(blob: Blob) {
    const pid = pendingPlayerIdRef.current;
    const player = players.find((p) => p.id === pid);
    setCropFile(null);
    if (!player) return;

    setUploadingId(player.id);
    try {
      const supabase = getSupabase();
      const path = `${player.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await api.players.updateAvatar(player.id, url);
      setPlayers((prev) => prev.map((p) => p.id === player.id ? { ...p, avatar_url: url } : p));
    } catch {
      // silent — player still works with emoji fallback
    } finally {
      setUploadingId(null);
    }
  }

  async function removePhoto(player: Player) {
    setActionPlayer(null);
    setUploadingId(player.id);
    try {
      await api.players.updateAvatar(player.id, null);
      setPlayers((prev) => prev.map((p) => p.id === player.id ? { ...p, avatar_url: null } : p));
    } catch {
      // non-critical
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="px-4 py-4 space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Add form */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">New Player</p>
        <form onSubmit={addPlayer} className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-6 gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                className={`aspect-square rounded-xl text-xl flex items-center justify-center transition-all ${
                  avatar === a
                    ? "bg-[#00d4ff]/15 ring-1 ring-[#00d4ff]/60 scale-110"
                    : "bg-[#1e1e1e] hover:bg-[#252525]"
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <label className="flex items-center gap-2 flex-1 bg-[#1a1a1a] border border-[#252525] rounded-xl px-3 focus-within:border-[#00d4ff]/40 transition-colors">
              <span className="text-lg shrink-0">{avatar}</span>
              <input
                type="text"
                placeholder="Player name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="flex-1 bg-transparent py-2.5 text-white text-sm placeholder-gray-700 focus:outline-none"
              />
            </label>
            <motion.button
              type="submit"
              disabled={adding || !name.trim()}
              whileTap={{ scale: 0.97 }}
              className="px-4 py-2.5 bg-[#00d4ff] text-black font-bold text-sm rounded-xl disabled:opacity-30 transition-opacity shrink-0"
            >
              {adding ? "…" : "Add"}
            </motion.button>
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-400 text-xs"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </form>
      </div>

      {/* Roster */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Roster · {players.length} player{players.length !== 1 ? "s" : ""}
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fetchError ? (
          <p className="text-red-400 text-sm text-center py-8">{fetchError}</p>
        ) : players.length === 0 ? (
          <p className="text-gray-700 text-sm text-center py-8">No players yet.</p>
        ) : (
          <AnimatePresence initial={false}>
            {players.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16, height: 0 }}
                transition={{ delay: i * 0.03, duration: 0.18 }}
                className="flex items-center gap-3 bg-[#141414] border border-[#1e1e1e] rounded-2xl px-4 py-3"
              >
                {/* Avatar button — tap to open photo action sheet */}
                <button
                  onClick={() => setActionPlayer(p)}
                  className="relative shrink-0 w-10 h-10 flex items-center justify-center"
                >
                  {uploadingId === p.id ? (
                    <div className="w-10 h-10 rounded-full border border-[#2a2a2a] flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      <AvatarDisplay
                        avatarUrl={p.avatar_url}
                        characterAvatar={p.character_avatar}
                        imgClassName="w-10 h-10"
                        emojiClassName="text-2xl"
                      />
                      {/* Camera badge */}
                      <span
                        className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center"
                        style={{ fontSize: "8px" }}
                      >
                        📷
                      </span>
                    </>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-gray-600 text-xs">{p.gp_played} GPs · {p.rating.toFixed(2)} pts</p>
                </div>
                <button
                  onClick={() => deletePlayer(p.id)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Photo action sheet */}
      <AnimatePresence>
        {actionPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-4"
            onClick={() => setActionPlayer(null)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden"
            >
              {/* Player header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1e1e1e]">
                <AvatarDisplay
                  avatarUrl={actionPlayer.avatar_url}
                  characterAvatar={actionPlayer.character_avatar}
                  imgClassName="w-10 h-10"
                  emojiClassName="text-2xl"
                />
                <p className="text-white font-semibold text-sm">{actionPlayer.name}</p>
              </div>

              <button
                onClick={() => startPhotoPicker(actionPlayer)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors border-b border-[#1e1e1e]"
              >
                <span className="text-lg">📷</span>
                <span className="text-white text-sm font-medium">
                  {actionPlayer.avatar_url ? "Change Photo" : "Add Photo"}
                </span>
              </button>

              {actionPlayer.avatar_url && (
                <button
                  onClick={() => removePhoto(actionPlayer)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors border-b border-[#1e1e1e]"
                >
                  <span className="text-lg">🗑️</span>
                  <span className="text-red-400 text-sm font-medium">Remove Photo</span>
                </button>
              )}

              <button
                onClick={() => setActionPlayer(null)}
                className="w-full px-5 py-4 text-gray-500 text-sm font-medium hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crop preview modal */}
      <AnimatePresence>
        {cropFile && (
          <PhotoCropModal
            file={cropFile}
            onConfirm={handlePhotoConfirmed}
            onCancel={() => setCropFile(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
