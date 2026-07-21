// src/app/api/settings/route.ts
// Singleton settings: get & update.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    let settings = await db.settings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      settings = await db.settings.create({ data: { id: "singleton" } });
    }
    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error("[API GET /settings]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const allowed: Record<string, boolean> = {
      webhookUrl: true,
      orchestratorAgentId: true,
      autonomousMode: true,
      autonomousIntervalMin: true,
      voiceEnabled: true,
      n8nBaseUrl: true,
      n8nApiKey: true,
      sessionIdleTimeoutMin: true,
    };

    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (allowed[k]) data[k] = v;
    }

    // Upsert: pastikan singleton ada
    let settings = await db.settings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      settings = await db.settings.create({
        data: { id: "singleton", ...(data as any) },
      });
    } else if (Object.keys(data).length > 0) {
      settings = await db.settings.update({
        where: { id: "singleton" },
        data: data as any,
      });
    }

    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error("[API PATCH /settings]", err);
    return NextResponse.json(
      { error: err?.message || "Gagal update settings" },
      { status: 500 }
    );
  }
}
