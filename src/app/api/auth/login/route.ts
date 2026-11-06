import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_MAX_AGE, codeMatches, createSession } from "@/lib/admin-auth";

// Best effort per server instance: enough to make guessing the code slow.
const MAX_TRIES = 5;
const LOCK_MS = 10 * 60 * 1000;
const failures = new Map<string, { count: number; until: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const entry = failures.get(ip);
  if (entry && entry.until > Date.now()) {
    return NextResponse.json({ error: "Too many tries — wait 10 minutes" }, { status: 429 });
  }

  const { code } = await req.json().catch(() => ({})) as { code?: unknown };
  if (typeof code !== "string" || !(await codeMatches(code))) {
    const count = (entry && entry.until <= Date.now() && entry.count >= MAX_TRIES ? 0 : entry?.count ?? 0) + 1;
    failures.set(ip, { count, until: count >= MAX_TRIES ? Date.now() + LOCK_MS : 0 });
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Wrong code" }, { status: 401 });
  }

  failures.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  return res;
}
