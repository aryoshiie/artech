// src/app/api/auth/status/route.ts
// Cek status auth: apakah setup sudah dilakukan + apakah user sedang login.
// PENTING: kalau DB error, assume setupComplete=true supaya redirect ke /login (bukan /setup)

import { NextResponse } from "next/server";
import { getCurrentUser, isSetupComplete } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  // Default: assume setup sudah done (supaya tidak redirect ke /setup saat error)
  let setupComplete = true;
  let user = null;

  try {
    [setupComplete, user] = await Promise.all([
      isSetupComplete(),
      getCurrentUser(),
    ]);
  } catch (err: any) {
    console.error("[API GET /auth/status] DB error (fallback to setupComplete=true):", err?.message);
    // JANGAN return 500 — itu bikin client side error.
    // Return setupComplete=true supaya client redirect ke /login (bukan /setup)
  }

  return NextResponse.json({
    setupComplete,
    loggedIn: !!user,
    username: user?.username,
  });
}
