// src/app/api/auth/status/route.ts
// Cek status auth: apakah setup sudah dilakukan + apakah user sedang login.

import { NextResponse } from "next/server";
import { getCurrentUser, isSetupComplete } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [setupComplete, user] = await Promise.all([
      isSetupComplete(),
      getCurrentUser(),
    ]);

    return NextResponse.json({
      setupComplete,
      loggedIn: !!user,
      username: user?.username,
    });
  } catch (err: any) {
    console.error("[API GET /auth/status]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memeriksa status auth" },
      { status: 500 }
    );
  }
}
