import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

const SAMPLE_PLAYERS = [
  { name: "Valentino", character_avatar: "🦊" },
  { name: "Marie", character_avatar: "👸" },
  { name: "Axel", character_avatar: "🐸" },
  { name: "Lena", character_avatar: "🌸" },
  { name: "Riku", character_avatar: "⭐" },
];

// 10 GPs: each is an array of positions for players 0–4
// Positions are 1-indexed; gaps get bots implicitly (not stored)
const SEED_GPs: number[][] = [
  [1, 3, 5, 8, 12],
  [2, 1, 4, 6, 9],
  [3, 2, 1, 10, 7],
  [1, 4, 6, 2, 11],
  [5, 3, 2, 1, 8],
  [2, 6, 1, 4, 3],
  [1, 2, 7, 5, 4],
  [4, 1, 3, 9, 2],
  [3, 5, 2, 1, 6],
  [1, 3, 4, 2, 8],
];

export async function POST() {
  const supabase = getServerSupabase();

  // Wipe existing seed data if re-running
  const { data: existing } = await supabase
    .from("players")
    .select("id, name")
    .in("name", SAMPLE_PLAYERS.map((p) => p.name));

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Seed data already exists. Delete the sample players first." },
      { status: 409 }
    );
  }

  // Insert players
  const { data: insertedPlayers, error: playerError } = await supabase
    .from("players")
    .insert(SAMPLE_PLAYERS)
    .select("id, name");

  if (playerError || !insertedPlayers) {
    return NextResponse.json({ error: playerError?.message ?? "Failed to insert players" }, { status: 500 });
  }

  // Map name → id
  const idMap = Object.fromEntries(insertedPlayers.map((p) => [p.name, p.id]));
  const playerIds = SAMPLE_PLAYERS.map((p) => idMap[p.name]);

  // Insert 10 GPs
  for (const gp of SEED_GPs) {
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({})
      .select("id")
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
    }

    const rows = gp.map((position, playerIndex) => ({
      match_id: match.id,
      player_id: playerIds[playerIndex],
      position,
    }));

    const { error: raceError } = await supabase.from("race_results").insert(rows);
    if (raceError) {
      return NextResponse.json({ error: raceError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    message: "Seeded 5 players and 10 Grand Prix records successfully.",
    players: SAMPLE_PLAYERS.map((p, i) => ({ ...p, id: playerIds[i] })),
  });
}
