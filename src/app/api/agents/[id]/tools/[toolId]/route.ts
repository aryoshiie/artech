// src/app/api/agents/[id]/tools/[toolId]/route.ts
// Update & delete a tool.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  try {
    const { id, toolId } = await params;
    const body = await req.json().catch(() => ({}));

    const allowed: Record<string, boolean> = {
      name: true,
      desc: true,
      color: true,
      icon: true,
      size: true,
      orbit: true,
      duration: true,
      callCount: true,
    };

    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (allowed[k]) data[k] = v;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Tidak ada field untuk diupdate" }, { status: 400 });
    }

    const tool = await db.tool.updateMany({
      where: { id: toolId, agentId: id },
      data,
    });
    if (tool.count === 0) {
      return NextResponse.json({ error: "Tool tidak ditemukan" }, { status: 404 });
    }
    const updated = await db.tool.findUnique({ where: { id: toolId } });
    return NextResponse.json({ tool: updated });
  } catch (err: any) {
    console.error("[API PATCH /agents/[id]/tools/[toolId]]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal update tool" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  try {
    const { id, toolId } = await params;
    const result = await db.tool.deleteMany({
      where: { id: toolId, agentId: id },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Tool tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: toolId });
  } catch (err: any) {
    console.error("[API DELETE /agents/[id]/tools/[toolId]]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal menghapus tool" },
      { status: 500 }
    );
  }
}
