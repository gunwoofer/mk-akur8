import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { loadTracks } from "@/lib/tracks";

// Active tracks in the game's order. Every list uses this fixed order so each track is
// always in the same place (the admin picker especially).
export async function GET() {
  try {
    return NextResponse.json(await loadTracks(getServerSupabase()));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
