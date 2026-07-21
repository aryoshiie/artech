// src/app/api/auth/logout/route.ts
// Logout: hapus session dari DB + clear cookie.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCurrentUser,
  deleteSession,
  logAccess,
  SESSION_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
      await deleteSession(token);
    }
    cookieStore.delete(SESSION_COOKIE);

    await logAccess("logout", user?.id ?? null, req);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API POST /auth/logout]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal logout" },
      { status: 500 }
    );
  }
}
