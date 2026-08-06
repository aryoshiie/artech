// src/app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncToPromptLibrary, deleteFromPromptLibrary } from "@/lib/sync-prompt";

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
    return NextResponse.json({ ...agent, messageCount });
  } catch (err: any) {
    console.error("[API GET /agents/[id]]", err);
    return NextResponse.json({ error: "Gagal memuat agent" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const allowed = [
      "name", "role", "desc", "color", "glow", "size", "orbit", "duration", "ring",
      "routingKeywords", "orchestratorOrder",
      "voicePitch", "voiceRate", "voiceGender", "voiceName",
      "webhookUrl", "systemPrompt", "userPrompt", "isActive", "workflowId",
    ];

    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        data[key] = body[key];
      }
    }

       if ("isActive" in data) {
      data.enabled = data.isActive;
      delete data.isActive;
    }

    const updated = await db.agent.update({
      where: { id },
      data,
      include: { tools: true },
    });

    // 🔥 AUTO-SYNC ke prompt_library
    await syncToPromptLibrary({
      id: updated.id,
      name: updated.name,
      role: updated.role,
      systemPrompt: updated.systemPrompt,
      userPrompt: updated.userPrompt,
      enabled: updated.enabled,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("[API PATCH /agents/[id]]", err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Agent tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Gagal update agent" }, { status: 500 });
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
        { error: "Agent core (Inti Galaksi) tidak boleh dihapus" },
        { status: 400 }
      );
    }

    await deleteFromPromptLibrary(id);

    await db.agent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API DELETE /agents/[id]]", err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Agent tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Gagal hapus agent" }, { status: 500 });
  }
}
