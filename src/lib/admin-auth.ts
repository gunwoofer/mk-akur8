import { NextRequest, NextResponse } from "next/server";

// The admin session is a signed expiry date in an HttpOnly cookie: no table, no user accounts.
// Changing ADMIN_SESSION_SECRET signs everyone out.
export const ADMIN_COOKIE = "mk_admin";
export const ADMIN_MAX_AGE = 90 * 24 * 60 * 60;

async function sign(message: string): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(): Promise<string> {
  const expires = String(Math.floor(Date.now() / 1000) + ADMIN_MAX_AGE);
  return `${expires}.${await sign(expires)}`;
}

export async function isValidSession(value: string | undefined): Promise<boolean> {
  if (!value || !process.env.ADMIN_SESSION_SECRET) return false;
  const [expires, mac] = value.split(".");
  if (!expires || !mac || Number(expires) * 1000 < Date.now()) return false;
  return (await sign(expires)) === mac;
}

// Case and surrounding spaces don't matter: phones like to capitalise the first letter.
// Both sides go through the HMAC so the comparison doesn't leak the code's length or prefix.
export async function codeMatches(input: string): Promise<boolean> {
  const code = process.env.ADMIN_CODE;
  if (!code) return false;
  return (await sign(`code:${input.trim().toLowerCase()}`)) === (await sign(`code:${code.trim().toLowerCase()}`));
}

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  if (await isValidSession(req.cookies.get(ADMIN_COOKIE)?.value)) return null;
  return NextResponse.json({ error: "Admin code required" }, { status: 401 });
}
