// src/app/api/auth/logs/route.ts
// List access log (hanya untuk user yang login).
// Query: ?limit=50&event=login_failed

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — login diperlukan" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
    const event = searchParams.get("event");

    const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT));

    const where: { event?: string } = {};
    if (event && event.trim()) {
      where.event = event.trim();
    }

    const logs = await db.accessLog.findMany({
      where,
      select: {
        id: true,
        event: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error("[API GET /auth/logs]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat access log" },
      { status: 500 }
    );
  }
}
