import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidSession } from "@/lib/admin-auth";

// /admin and every API call that writes need the admin cookie. The dashboard and all reads stay public.
// Each write route also checks it itself (requireAdmin), in case a route ever slips out of this matcher.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  if (isApi && (req.method === "GET" || req.method === "HEAD" || pathname.startsWith("/api/auth/"))) {
    return NextResponse.next();
  }
  if (await isValidSession(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Admin code required" }, { status: 401 });
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
