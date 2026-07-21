// src/app/api/executions/route.ts
// List agent executions with filters + cursor pagination.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId");
    const sessionId = url.searchParams.get("sessionId");
    const status = url.searchParams.get("status");
    const before = url.searchParams.get("before"); // ISO cursor
    const limitRaw = Number(url.searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(limitRaw || 50, 1), 200);

    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (sessionId) where.sessionId = sessionId;
    if (status) where.status = status;
    if (before) {
      const d = new Date(before);
      if (!isNaN(d.getTime())) where.startedAt = { lt: d };
    }

    const executions = await db.agentExecution.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit + 1,
      include: {
        agent: { select: { id: true, name: true, color: true } },
      },
    });

    const hasMore = executions.length > limit;
    const slice = hasMore ? executions.slice(0, limit) : executions;
    const nextCursor = hasMore && slice.length > 0
      ? slice[slice.length - 1].startedAt.toISOString()
      : null;

    return NextResponse.json({
      executions: slice,
      hasMore,
      nextCursor,
    });
  } catch (err: any) {
    console.error("[API GET /executions]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat executions" },
      { status: 500 }
    );
  }
}
