// middleware.ts — Proteksi semua route, redirect ke /login kalau belum auth
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
  "/setup-database.sql",
  "/setup-n8n.md",
  "/DEPLOY-GITHUB-VERCEL.md",
];

const STATIC_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/logo.svg",
  "/fonts",
  "/icons",
  "/earth-nasa.jpg",
  "/arc-reactor-ref",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg|fonts|icons|upload).*)",
  ],
};
