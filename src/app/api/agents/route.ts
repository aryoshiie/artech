// src/app/api/agents/route.ts
// List & create agents. ID auto-generate: AGT-001, AGT-002, dst.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateWebhookUrl } from "@/lib/n8n";

export const runtime = "nodejs";

async function generateAgentId(): Promise<string> {
  const agents = await db.agent.findMany({ select: { id: true } });
  const numbers = agents
    .map((a) => parseInt((a.id || "").replace("AGT-", ""), 10))
    .filter((n) => !isNaN(n));
  const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `AGT-${String(nextNum).padStart(3, "0")}`;
}

export async function GET(_req: NextRequest) {
  try {
    const agents = await db.agent.findMany({
      include: { tools: true },
      orderBy: [{ isCore: "desc" }, { orchestratorOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ agents });
  } catch (err: any) {
    console.error("[API GET /agents]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat daftar agent" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, role, desc, color, voicePitch, voiceRate, voiceGender, voiceName } = body as {
      name?: string;
      role?: string;
      desc?: string;
      color?: string;
      voicePitch?: number;
      voiceRate?: number;
      voiceGender?: string;
      voiceName?: string;
    };

    if (!name || !role || !color) {
      return NextResponse.json(
        { error: "Field wajib: name, role, color" },
        { status: 400 }
      );
    }

    const agentId = await generateAgentId();
    const webhookUrl = await generateWebhookUrl(agentId);
    const routingKeywords = name.toLowerCase().trim();

    const maxOrder = await db.agent.aggregate({
      _max: { orchestratorOrder: true },
    });
    const nextOrder = (maxOrder._max.orchestratorOrder ?? -1) + 1;

    const agent = await db.agent.create({
      data: {
        id: agentId,
        name,
        role,
        desc: desc ?? "",
        color,
        voicePitch: typeof voicePitch === "number" ? voicePitch : 1,
        voiceRate: typeof voiceRate === "number" ? voiceRate : 1,
        voiceGender: voiceGender || "neutral",
        voiceName: voiceName || null,
        webhookUrl,
        routingKeywords,
        orchestratorOrder: nextOrder,
        isCore: false,
        custom: true,
      },
      include: { tools: true },
    });

    return NextResponse.json({ agent, webhookUrl }, { status: 201 });
  } catch (err: any) {
    console.error("[API POST /agents]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal membuat agent" },
      { status: 500 }
    );
  }
}
