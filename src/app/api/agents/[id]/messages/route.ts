// src/app/api/agents/[id]/messages/route.ts
// List messages for an agent with cursor pagination.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(limitRaw || 50, 1), 200);
    const before = url.searchParams.get("before"); // ISO string cursor

    const agent = await db.agent.findUnique({ where: { id }, select: { id: true } });
    if (!agent) {
      return NextResponse.json({ error: "Agent tidak ditemukan" }, { status: 404 });
    }

    const where: any = { agentId: id };
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        where.createdAt = { lt: beforeDate };
      }
    }

    const messages = await db.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // ambil 1 ekstra untuk cek hasMore
    });

    const hasMore = messages.length > limit;
    const slice = hasMore ? messages.slice(0, limit) : messages;
    // Balik ke ascending biar enak render di UI
    slice.reverse();
    const nextCursor = hasMore && slice.length > 0
      ? slice[0].createdAt.toISOString()
      : null;

    return NextResponse.json({
      messages: slice,
      hasMore,
      nextCursor,
    });
  } catch (err: any) {
    console.error("[API GET /agents/[id]/messages]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat pesan" },
      { status: 500 }
    );
  }
}
