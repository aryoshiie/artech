// middleware.ts — Proteksi semua route, redirect ke /login kalau belum auth
// Route public: /login, /setup, /api/auth/*, /api/debug, /artech-deploy.zip, /_next, /favicon.ico
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/download",
  "/api/auth",
  "/api/debug",
  "/api/auth/status",
  "/artech-deploy.zip",
];

const STATIC_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/logo.svg",
  "/fonts",
  "/icons",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Cek session cookie
  const session = req.cookies.get("artech-session")?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match semua route kecuali static + api/auth
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg|fonts|icons).*)",
  ],
};
