// src/app/api/agents/[id]/route.ts
// Get, update, delete single agent.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await db.agent.findUnique({
      where: { id },
      include: { tools: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent tidak ditemukan" }, { status: 404 });
    }
    const messageCount = await db.message.count({ where: { agentId: id } });
    return NextResponse.json({ agent, messageCount });
  } catch (err: any) {
    console.error("[API GET /agents/[id]]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat agent" },
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

    const allowed: Record<string, boolean> = {
      name: true,
      role: true,
      desc: true,
      color: true,
      glow: true,
      size: true,
      orbit: true,
      duration: true,
      ring: true,
      routingKeywords: true,
      orchestratorOrder: true,
      voicePitch: true,
      voiceRate: true,
      voiceGender: true,
      voiceName: true,
      webhookUrl: true,
      workflowId: true,
    };

    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (allowed[k]) data[k] = v;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Tidak ada field untuk diupdate" }, { status: 400 });
    }

    const agent = await db.agent.update({
      where: { id },
      data,
      include: { tools: true },
    });
    return NextResponse.json({ agent });
  } catch (err: any) {
    console.error("[API PATCH /agents/[id]]", err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Agent tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err?.message || "Gagal update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent tidak ditemukan" }, { status: 404 });
    }
    if (agent.isCore) {
      return NextResponse.json(
        { error: "Agent core (orchestrator) tidak boleh dihapus" },
        { status: 400 }
      );
    }
    // Cascade: tools, messages, executions (Tool & Message & AgentExecution punya onDelete: Cascade)
    await db.agent.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    console.error("[API DELETE /agents/[id]]", err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Agent tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err?.message || "Gagal menghapus agent" },
      { status: 500 }
    );
  }
}
