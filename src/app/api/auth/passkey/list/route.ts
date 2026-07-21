// src/app/api/auth/passkey/list/route.ts
// List passkey user yang sedang login (untuk management).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — login diperlukan" },
        { status: 401 }
      );
    }

    const passkeys = await db.passkey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ passkeys });
  } catch (err: any) {
    console.error("[API GET /auth/passkey/list]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat daftar passkey" },
      { status: 500 }
    );
  }
}
