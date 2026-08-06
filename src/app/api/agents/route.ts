// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncToPromptLibrary } from "@/lib/sync-prompt";

export const runtime = "nodejs";

export async function GET() {
  try {
    const agents = await db.agent.findMany({
      include: { tools: true },
      orderBy: [{ isCore: "desc" }, { orchestratorOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(agents);
  } catch (err: any) {
    console.error("[API GET /agents]", err);
    return NextResponse.json({ error: "Gagal memuat agent" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.role || !body.color) {
      return NextResponse.json(
        { error: "Field wajib: name, role, color" },
        { status: 400 }
      );
    }

    const existingAgents = await db.agent.findMany({
      where: { id: { startsWith: "AGT-" } },
      select: { id: true },
    });
    const maxNum = existingAgents.reduce((max, a) => {
      const m = a.id.match(/^AGT-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const newId = `AGT-${String(maxNum + 1).padStart(3, "0")}`;

    const settings = await db.settings.findUnique({ where: { id: "singleton" } });
    const base = (settings?.n8nBaseUrl || "https://your-n8n.example.com").replace(/\/$/, "");
    const webhookUrl = `${base}/webhook/agent-${newId}`;

    const maxOrder = await db.agent.count({ where: { isCore: false } });

    const created = await db.agent.create({
      data: {
        id: newId,
        name: body.name,
        role: body.role,
        desc: body.desc || "",
        color: body.color,
        glow: body.glow || "",
        size: body.size || 4,
        orbit: body.orbit || 30,
        duration: body.duration || 20,
        ring: body.ring || false,
        isCore: false,
        custom: true,
        routingKeywords: body.routingKeywords || body.name.toLowerCase(),
        orchestratorOrder: maxOrder + 1,
        voicePitch: body.voicePitch || 1,
        voiceRate: body.voiceRate || 1,
        voiceGender: body.voiceGender || "neutral",
        voiceName: body.voiceName || null,
        webhookUrl,
        systemPrompt: body.systemPrompt || null,
        userPrompt: body.userPrompt || null,
      },
      include: { tools: true },
    });

    // 🔥 AUTO-SYNC ke prompt_library
    await syncToPromptLibrary({
      id: created.id,
      name: created.name,
      role: created.role,
      systemPrompt: created.systemPrompt,
      userPrompt: created.userPrompt,
      enabled: created.enabled,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error("[API POST /agents]", err);
    return NextResponse.json(
      { error: "Gagal membuat agent", details: err?.message },
      { status: 500 }
    );
  }
}
