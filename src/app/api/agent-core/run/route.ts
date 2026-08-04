// src/app/api/agent-core/run/route.ts
// Authenticated proxy for running an artech agent through the agent-core
// mini-service. Verifies the agent exists in Prisma, then calls runAgent()
// (which talks to http://localhost:3030/run-task under the hood).
//
// Body: { agentId: string, task: string, sessionId?: string }
// Returns: { ok: boolean, sessionId?: string, result: string, error?: string }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { runAgent, buildDefaultSystemPrompt } from "@/lib/agent-core";

export const runtime = "nodejs";
// Tool loops can take a while — cap at 2 minutes (matches the underlying
// fetch timeout in lib/agent-core.ts).
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // --- Auth check ---
  // The dashboard uses cookie-based auth (AuthSession token). Reject any
  // caller that isn't logged in. (In demo mode where middleware is a no-op,
  // this still guards the route at the API layer.)
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized — silakan login terlebih dahulu." },
      { status: 401 }
    );
  }

  // --- Parse + validate body ---
  const body = await req.json().catch(() => ({}));
  const agentId = String(body.agentId ?? "").trim();
  const task = String(body.task ?? "").trim();
  const sessionId = body.sessionId ? String(body.sessionId) : undefined;

  if (!agentId) {
    return NextResponse.json({ error: "agentId wajib diisi" }, { status: 400 });
  }
  if (!task) {
    return NextResponse.json({ error: "task wajib diisi" }, { status: 400 });
  }

  // --- Verify agent exists in Prisma DB ---
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    return NextResponse.json(
      { error: `Agent "${agentId}" tidak ditemukan di database.` },
      { status: 404 }
    );
  }
  if (!agent.enabled) {
    return NextResponse.json(
      { error: `Agent "${agent.name}" sedang dinonaktifkan. Aktifkan dulu di panel agent.` },
      { status: 400 }
    );
  }

  // --- Build RunAgentRequest from agent config ---
  const toolWhitelist = (agent.toolWhitelist || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // --- Call agent-core ---
  const result = await runAgent({
    agentId: agent.id,
    task,
    sessionId,
    systemPrompt:
      agent.systemPrompt?.trim() ||
      buildDefaultSystemPrompt(
        { name: agent.name, role: agent.role, desc: agent.desc },
        "default",
      ),
    toolWhitelist: toolWhitelist.length > 0 ? toolWhitelist : undefined,
    maxIterations: agent.maxIterations || 25,
    temperature: agent.temperature ?? 0.7,
  });

  if (!result.ok) {
    // Distinguish "agent-core down" from "agent-core returned an error".
    // The client UI uses the error message to render actionable guidance.
    const isConnectionError =
      result.error &&
      (result.error.toLowerCase().includes("fetch failed") ||
        result.error.toLowerCase().includes("econnrefused") ||
        result.error.toLowerCase().includes("agent core failed"));

    return NextResponse.json(
      {
        ok: false,
        result: "",
        error: isConnectionError
          ? `Agent Core mini-service tidak berjalan. Jalankan: \`cd mini-services/agent-core && bun run dev\`. Detail: ${result.error}`
          : result.error,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(result);
}
