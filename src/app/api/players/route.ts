import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { compareRank } from "@/lib/ranking";
import { fetchAll } from "@/lib/fetch-all";
import type { Player } from "@/types";

export async function GET() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("players").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let wins: { player_id: string }[];
  try {
    wins = await fetchAll((from, to) =>
      supabase.from("race_results").select("player_id").eq("position", 1).order("id").range(from, to));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const p1Counts = new Map<string, number>();
  for (const { player_id } of wins) p1Counts.set(player_id, (p1Counts.get(player_id) ?? 0) + 1);

  const players: Player[] = (data ?? [])
    .map((p) => ({ ...p, p1_count: p1Counts.get(p.id) ?? 0 }))
    .sort((a, b) => compareRank(
      { rating: a.rating, p1: a.p1_count, name: a.name },
      { rating: b.rating, p1: b.p1_count, name: b.name },
    ));

  return NextResponse.json(players);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("players")
    .insert({ name: body.name.trim(), character_avatar: body.character_avatar ?? "🏎️" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
