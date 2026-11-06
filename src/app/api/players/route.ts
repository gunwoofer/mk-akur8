import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { rankedPlayers } from "@/lib/players";

// ?archived=1 lists archived players instead of active ones.
export async function GET(req: NextRequest) {
  const archived = new URL(req.url).searchParams.get("archived") === "1";
  try {
    return NextResponse.json(await rankedPlayers(getServerSupabase(), archived));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
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
