// src/app/api/auth/status/route.ts
// Cek status auth: apakah setup sudah dilakukan + apakah user sedang login.
// PENTING: kalau DB error, assume setupComplete=true supaya redirect ke /login (bukan /setup)

import { NextResponse } from "next/server";
import { getCurrentUser, isSetupComplete } from "@/lib/auth";
import { db } from "@/lib/db";

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
    console.error("[API GET /auth/status] Unexpected error (fallback to setupComplete=true):", err?.message);
    setupComplete = true;
  }

  // Final safety net: JANGAN pernah return setupComplete=false jika ada kemungkinan DB error.
  if (!setupComplete && !user) {
    try {
      const retryCount = await db.user.count();
      setupComplete = retryCount > 0;
    } catch {
      console.error("[API GET /auth/status] Retry failed, forcing setupComplete=true");
      setupComplete = true;
    }
  }

  return NextResponse.json({
    setupComplete,
    loggedIn: !!user,
    username: user?.username,
  });
}
