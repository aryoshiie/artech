// src/app/api/sessions/[id]/route.ts
// Detail, update session.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SessionStatus, SessionMode } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await db.session.findUnique({
      where: { id },
      include: {
        activeAgent: {
          select: { id: true, name: true, role: true, color: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
        },
        executions: {
          orderBy: { startedAt: "desc" },
          take: 50,
          include: {
            agent: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });
    if (!session) {
      return NextResponse.json({ error: "Session tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (err: any) {
    console.error("[API GET /sessions/[id]]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat session" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const data: Record<string, unknown> = {};
    if (typeof body.status === "string") data.status = body.status as SessionStatus;
    if (typeof body.mode === "string") data.mode = body.mode as SessionMode;
    if (body.activeAgentId !== undefined) data.activeAgentId = body.activeAgentId;
    if (typeof body.lastActivityAt === "string") data.lastActivityAt = new Date(body.lastActivityAt);

    // Helper untuk end session manual
    if (body.status === "ended_user" || body.status === "ended_idle" || body.status === "ended_error") {
      data.endedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Tidak ada field untuk diupdate" }, { status: 400 });
    }

    const session = await db.session.update({
      where: { id },
      data,
      include: {
        activeAgent: {
          select: { id: true, name: true, role: true, color: true },
        },
      },
    });
    return NextResponse.json({ session });
  } catch (err: any) {
    console.error("[API PATCH /sessions/[id]]", err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Session tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err?.message || "Gagal update session" },
      { status: 500 }
    );
  }
}
