// src/app/api/sessions/route.ts
// List & create sessions.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SessionStatus, SessionMode } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status"); // active | ended_user | ended_agent | ...
    const limitRaw = Number(url.searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(limitRaw || 50, 1), 200);

    const where: any = {};
    if (status) where.status = status;

    const sessions = await db.session.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        activeAgent: {
          select: { id: true, name: true, role: true, color: true },
        },
      },
    });

    return NextResponse.json({ sessions });
  } catch (err: any) {
    console.error("[API GET /sessions]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { mode, activeAgentId } = body as {
      mode?: SessionMode;
      activeAgentId?: string;
    };

    if (activeAgentId) {
      const ag = await db.agent.findUnique({ where: { id: activeAgentId }, select: { id: true } });
      if (!ag) {
        return NextResponse.json({ error: "activeAgentId tidak valid" }, { status: 400 });
      }
    }

    const session = await db.session.create({
      data: {
        mode: mode || "default",
        status: "active",
        activeAgentId: activeAgentId ?? null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      },
      include: {
        activeAgent: {
          select: { id: true, name: true, role: true, color: true },
        },
      },
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err: any) {
    console.error("[API POST /sessions]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal membuat session" },
      { status: 500 }
    );
  }
}
