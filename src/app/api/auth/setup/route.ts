// src/app/api/auth/setup/route.ts
// Setup owner user pertama kali. Hanya bisa dipanggil sekali (kalau belum ada user).

import { NextRequest, NextResponse } from "next/server";
import { createOwnerUser, isSetupComplete, logAccess } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Cek apakah sudah pernah setup
    const alreadySetup = await isSetupComplete();
    if (alreadySetup) {
      await logAccess("access_denied", null, req, {
        reason: "setup_already_complete",
        endpoint: "/api/auth/setup",
      });
      return NextResponse.json(
        { error: "Owner user sudah ada. Setup tidak bisa diulang." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Field wajib: username, password" },
        { status: 400 }
      );
    }
    if (typeof username !== "string" || username.trim().length < 3) {
      return NextResponse.json(
        { error: "Username minimal 3 karakter" },
        { status: 400 }
      );
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password minimal 8 karakter" },
        { status: 400 }
      );
    }

    const user = await createOwnerUser(username.trim(), password);

    await logAccess("setup_complete", user.id, req, { username: username.trim() });

    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch (err: any) {
    console.error("[API POST /auth/setup]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal melakukan setup" },
      { status: 500 }
    );
  }
}
