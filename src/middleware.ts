// middleware.ts — Disabled auth for demo (no-op)
// Originally protected routes with login redirect; now allows all traffic.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg|fonts|icons|upload).*)"],
};
