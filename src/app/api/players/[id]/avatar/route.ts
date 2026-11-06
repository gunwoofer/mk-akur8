import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";

const MAX_BYTES = 2 * 1024 * 1024;

// The cropped photo arrives as a JPEG body; only the server (service role) may write to the avatars bucket.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (req.headers.get("content-type") !== "image/jpeg") {
    return NextResponse.json({ error: "Expected a JPEG" }, { status: 400 });
  }
  const body = await req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Photo must be under 2 MB" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const path = `${id}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: url } = supabase.storage.from("avatars").getPublicUrl(path);
  const { data, error } = await supabase
    .from("players")
    .update({ avatar_url: `${url.publicUrl}?t=${Date.now()}` })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
