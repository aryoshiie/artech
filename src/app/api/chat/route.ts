// src/app/api/chat/route.ts
// Main chat endpoint — routing Lapis 1 + n8n sync call.
//
// Body:
//   { message: string,
//     files?: Array<{ name: string; size: number; ext: string; kind: string; content: string }>,
//     sessionKey?: string }
//
// Alur:
// 1. Validasi: message tidak boleh kosong ATAU files tidak boleh kosong
// 2. Get/create session via getOrCreateSession
// 3. Ambil semua agent → routeMessage
// 4. Save user message
// 5. Kalau disconnect → tutup sesi, return reply standar (tidak call n8n)
// 6. Kalau tidak → update session, upload files, buat AgentExecution, call n8n sync,
//    save agent reply, update execution, optional endSessionByAgent.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAgentWebhookUrl,
  sendToN8n,
  type N8nPayload,
} from "@/lib/n8n";
import {
  routeMessage,
  getOrCreateSession,
  updateSessionAfterRouting,
  endSessionByAgent,
} from "@/lib/routing";
import { uploadFile } from "@/lib/supabase-storage";

export const runtime = "nodejs";

interface InboundFile {
  name: string;
  size: number;
  ext: string;
  kind: string;
  content: string; // base64 (data URL mentah atau raw)
}

function newSessionKey(): string {
  // Cuid-like ID (tidak ada dependency cuid → pakai crypto.randomUUID)
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `s_${time}${rand}`;
}

function stripDataUrl(content: string): { data: string; mime?: string } {
  const m = content.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (m) {
    return { data: m[3], mime: m[1] };
  }
  return { data: content };
}

export async function POST(req: NextRequest) {
  let session: { id: string; mode: "default" | "bypass"; activeAgentId?: string | null } | null = null;
  let executionId: string | null = null;
  let targetAgentId: string | null = null;
  const startedAt = new Date();

  try {
    const body = await req.json().catch(() => ({}));
    const {
      message,
      files,
      sessionKey: sessionKeyIn,
    } = body as {
      message?: string;
      files?: InboundFile[];
      sessionKey?: string;
    };

    const trimmedMessage = (message || "").trim();
    const hasFiles = Array.isArray(files) && files.length > 0;

    // 1. Validasi
    if (!trimmedMessage && !hasFiles) {
      return NextResponse.json(
        { error: "Pesan atau file tidak boleh kosong" },
        { status: 400 }
      );
    }

    // 2. Get/create session
    const sessionKey = sessionKeyIn || newSessionKey();
    session = await getOrCreateSession(sessionKey);
    if (!session) {
      return NextResponse.json(
        { error: "Gagal membuat/mengambil session" },
        { status: 500 }
      );
    }

    // 3. Ambil semua agent untuk routing
    const agents = await db.agent.findMany({
      select: {
        id: true,
        name: true,
        routingKeywords: true,
        isCore: true,
      },
    });
    if (agents.length === 0) {
      return NextResponse.json(
        { error: "Belum ada agent di sistem" },
        { status: 404 }
      );
    }

    // 4. Routing
    const routing = await routeMessage(trimmedMessage, agents, session);
    targetAgentId = routing.targetAgentId;
    const targetAgent = await db.agent.findUnique({
      where: { id: targetAgentId },
    });
    if (!targetAgent) {
      return NextResponse.json(
        { error: "Agent target tidak ditemukan" },
        { status: 404 }
      );
    }

    // 5. Save user message
    const savedFilesMeta = hasFiles
      ? files!.map((f) => ({
          name: f.name,
          size: f.size,
          ext: f.ext,
          kind: f.kind,
        }))
      : undefined;

    await db.message.create({
      data: {
        agentId: targetAgentId,
        sessionId: session.id,
        role: "user",
        text: trimmedMessage || null,
        files: savedFilesMeta ? (savedFilesMeta as any) : undefined,
      },
    });

    // 6. Disconnect → tutup sesi, return reply standar
    if (routing.isDisconnect) {
      await updateSessionAfterRouting(session.id, routing);
      const orchestrator = agents.find((a) => a.isCore) || agents[0];
      const orchAgent = await db.agent.findUnique({
        where: { id: orchestrator.id },
        select: {
          id: true, name: true, role: true, color: true, glow: true,
          voicePitch: true, voiceRate: true, voiceName: true,
        },
      });
      return NextResponse.json({
        reply: "Sesi diputus. Kembali ke orchestrator.",
        agent: orchAgent,
        session: null,
        endSession: true,
        isSwitch: false,
        executionId: null,
      });
    }

    // 7. Update session setelah routing
    await updateSessionAfterRouting(session.id, routing);

    // 8. Ambil webhook URL
    const webhookUrl = await getAgentWebhookUrl(targetAgentId);
    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Webhook belum diatur untuk agent ini" },
        { status: 400 }
      );
    }

    // 9. Upload files ke Supabase Storage (kalau ada)
    const attachments: N8nPayload["attachments"] = [];
    if (hasFiles) {
      for (const f of files!) {
        try {
          const { data: b64, mime } = stripDataUrl(f.content);
          const buffer = Buffer.from(b64, "base64");
          const ts = Date.now();
          const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `sessions/${sessionKey}/${ts}-${safeName}`;
          const uploaded = await uploadFile(buffer, path);
          attachments.push({
            name: f.name,
            ext: f.ext,
            kind: f.kind,
            size: f.size,
            url: uploaded.url,
            content: mime ? undefined : b64.slice(0, 8192), // potong kalau terlalu panjang
          });
        } catch (upErr: any) {
          console.error("[chat] upload file gagal:", upErr);
          // fallback: kirim content base64 apa adanya
          const { data: b64 } = stripDataUrl(f.content);
          attachments.push({
            name: f.name,
            ext: f.ext,
            kind: f.kind,
            size: f.size,
            content: b64,
          });
        }
      }
    }

    // 10. Create AgentExecution (status=running)
    const execution = await db.agentExecution.create({
      data: {
        agentId: targetAgentId,
        sessionId: session.id,
        status: "running",
        input: {
          message: trimmedMessage,
          filesCount: attachments.length,
          mode: routing.mode,
          sessionKey,
        } as any,
        startedAt,
      },
    });
    executionId = execution.id;

    // 11. Build payload
    const payload: N8nPayload = {
      agentId: targetAgentId,
      agentName: targetAgent.name,
      role: targetAgent.role,
      message: trimmedMessage,
      sessionId: session.id,
      mode: routing.mode,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: startedAt.toISOString(),
    };

    // 12. Send to n8n (sync)
    const n8nRes = await sendToN8n(webhookUrl, payload);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    // 13. N8n error
    if (n8nRes.error) {
      await db.agentExecution.update({
        where: { id: executionId },
        data: {
          status: "error",
          error: n8nRes.error,
          output: n8nRes as any,
          finishedAt,
          durationMs,
        },
      });
      return NextResponse.json(
        {
          error: n8nRes.error,
          agent: {
            id: targetAgent.id, name: targetAgent.name, role: targetAgent.role,
            color: targetAgent.color, glow: targetAgent.glow,
            voicePitch: targetAgent.voicePitch, voiceRate: targetAgent.voiceRate,
            voiceName: targetAgent.voiceName,
          },
          session: { id: session.id, mode: session.mode, activeAgentId: targetAgentId },
          executionId,
        },
        { status: 502 }
      );
    }

    const replyText = n8nRes.reply || "(Agent tidak mengembalikan teks)";
    const endSession = Boolean(n8nRes.endSession);

    // 14. Save agent reply sebagai message
    await db.message.create({
      data: {
        agentId: targetAgentId,
        sessionId: session.id,
        role: "agent",
        text: replyText,
      },
    });

    // 15. Update execution → success
    await db.agentExecution.update({
      where: { id: executionId },
      data: {
        status: "success",
        output: { reply: replyText, endSession } as any,
        finishedAt,
        durationMs,
      },
    });

    // 16. endSession signal → akhiri sesi
    if (endSession) {
      await endSessionByAgent(session.id);
    }

    return NextResponse.json({
      reply: replyText,
      agent: {
        id: targetAgent.id, name: targetAgent.name, role: targetAgent.role,
        color: targetAgent.color, glow: targetAgent.glow,
        voicePitch: targetAgent.voicePitch, voiceRate: targetAgent.voiceRate,
        voiceName: targetAgent.voiceName,
      },
      session: endSession
        ? null
        : { id: session.id, mode: routing.mode, activeAgentId: targetAgentId },
      endSession,
      isSwitch: routing.isSwitch,
      executionId,
    });
  } catch (err: any) {
    console.error("[API POST /chat]", err);
    // Coba simpan error ke execution kalau ada
    if (executionId) {
      try {
        await db.agentExecution.update({
          where: { id: executionId },
          data: {
            status: "error",
            error: err?.message || String(err),
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt.getTime(),
          },
        });
      } catch {
        // ignore
      }
    }
    return NextResponse.json(
      { error: err?.message || "Gagal memproses chat" },
      { status: 500 }
    );
  }
}
