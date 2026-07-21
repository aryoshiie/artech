// src/app/api/auth/login/route.ts
// Login dengan username + password.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  createSession,
  logAccess,
  verifyPassword,
  SESSION_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 hari (detik)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Field wajib: username, password" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { username } });

    if (!user || !user.passwordHash) {
      await logAccess("login_failed", user?.id ?? null, req, {
        reason: "user_not_found",
        username,
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await logAccess("login_failed", user.id, req, {
        reason: "invalid_password",
        username,
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Buat session + set cookie
    const token = await createSession(user.id, req);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    await logAccess("login_success", user.id, req, { username: user.username });

    return NextResponse.json({ success: true, username: user.username });
  } catch (err: any) {
    console.error("[API POST /auth/login]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal login" },
      { status: 500 }
    );
  }
}
