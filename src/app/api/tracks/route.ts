import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { loadTracks } from "@/lib/tracks";

// Active tracks, most raced first — the order the admin track picker shows them in.
export async function GET() {
  try {
    return NextResponse.json(await loadTracks(getServerSupabase()));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
