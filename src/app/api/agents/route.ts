// src/app/api/agents/route.ts
// List & create agents.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateWebhookUrl } from "@/lib/n8n";

export const runtime = "nodejs";

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSuffix(len = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
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

    // Generate ID dari slug + random suffix (kalau bukan core)
    const baseSlug = slugify(name) || "agent";
    let agentId = `${baseSlug}-${randomSuffix()}`;
    // Pastikan unik
    let exists = await db.agent.findUnique({ where: { id: agentId } });
    while (exists) {
      agentId = `${baseSlug}-${randomSuffix()}`;
      exists = await db.agent.findUnique({ where: { id: agentId } });
    }

    // Auto-generate webhook URL
    const webhookUrl = await generateWebhookUrl(agentId);

    // Auto-generate routingKeywords dari name (lowercase)
    const routingKeywords = name.toLowerCase().trim();

    // Auto-assign orchestratorOrder = max + 1
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
