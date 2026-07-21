// src/app/api/agents/[id]/tools/route.ts
// List & create tools for an agent.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await db.agent.findUnique({ where: { id }, select: { id: true } });
    if (!agent) {
      return NextResponse.json({ error: "Agent tidak ditemukan" }, { status: 404 });
    }
    const tools = await db.tool.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ tools });
  } catch (err: any) {
    console.error("[API GET /agents/[id]/tools]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat tools" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, desc, color, size, orbit, duration, icon } = body as {
      name?: string;
      desc?: string;
      color?: string;
      size?: number;
      orbit?: number;
      duration?: number;
      icon?: string;
    };

    if (!name || !color) {
      return NextResponse.json(
        { error: "Field wajib: name, color" },
        { status: 400 }
      );
    }

    const agent = await db.agent.findUnique({ where: { id }, select: { id: true } });
    if (!agent) {
      return NextResponse.json({ error: "Agent tidak ditemukan" }, { status: 404 });
    }

    const tool = await db.tool.create({
      data: {
        agentId: id,
        name,
        desc: desc ?? "",
        color,
        icon: icon ?? null,
        size: typeof size === "number" ? size : 1,
        orbit: typeof orbit === "number" ? orbit : 6,
        duration: typeof duration === "number" ? duration : 6,
      },
    });
    return NextResponse.json({ tool }, { status: 201 });
  } catch (err: any) {
    console.error("[API POST /agents/[id]/tools]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal membuat tool" },
      { status: 500 }
    );
  }
}
