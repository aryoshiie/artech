// src/lib/n8n.ts — HYBRID mode: n8n webhook OR LLM fallback per agent.
// Jika agent.webhookUrl di-set (URL http/https real) → kirim ke n8n workflow.
// Jika tidak di-set → fallback ke z-ai-web-dev-sdk LLM dengan persona per agent.

import { db } from "./db";
import ZAI from "z-ai-web-dev-sdk";

export interface N8nPayload {
  agentId: string;
  agentName: string;
  role: string;
  message: string;
  sessionId?: string;
  mode: "default" | "bypass";
  attachments?: Array<{
    name: string;
    ext: string;
    kind: string;
    size: number;
    url?: string;
    content?: string;
  }>;
  timestamp: string;
}

export interface N8nResponse {
  reply?: string;
  output?: string;
  text?: string;
  message?: string;
  endSession?: boolean;
  error?: string;
}

// zai singleton (initialized lazily)
let zaiInstance: any = null;
async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * Dapatkan webhook URL untuk agent.
 * Prioritas:
 *   1. agent.webhookUrl (kalau di-set & URL http real → n8n mode)
 *   2. settings.n8nBaseUrl → generate pattern {baseUrl}/webhook/agent-{agentId} (→ n8n mode)
 *   3. settings.webhookUrl (untuk orchestrator/core) (→ n8n mode)
 *   4. Fallback: internal://llm/{agentId} (→ LLM mode)
 */
export async function getAgentWebhookUrl(agentId: string): Promise<string | null> {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (agent?.webhookUrl && /^https?:\/\//.test(agent.webhookUrl)) {
    return agent.webhookUrl;
  }

  const settings = await db.settings.findUnique({ where: { id: "singleton" } });

  // Untuk orchestrator/core, pakai settings.webhookUrl
  if (agent?.isCore && settings?.webhookUrl && /^https?:\/\//.test(settings.webhookUrl)) {
    return settings.webhookUrl;
  }

  // Generate dari n8nBaseUrl pattern
  if (settings?.n8nBaseUrl && /^https?:\/\//.test(settings.n8nBaseUrl)) {
    return `${settings.n8nBaseUrl.replace(/\/$/, "")}/webhook/agent-${agentId}`;
  }

  if (settings?.webhookUrl && /^https?:\/\//.test(settings.webhookUrl)) {
    return settings.webhookUrl;
  }

  // Fallback: LLM mode
  return `internal://llm/${agentId}`;
}

/**
 * Generate webhook URL pattern untuk agent baru (dipakai di AddAgentModal).
 */
export async function generateWebhookUrl(agentId: string): Promise<string> {
  const settings = await db.settings.findUnique({ where: { id: "singleton" } });
  const base = (settings?.n8nBaseUrl || "https://your-n8n.example.com").replace(/\/$/, "");
  return `${base}/webhook/agent-${agentId}`;
}

/**
 * Cek apakah URL adalah internal LLM (bukan n8n webhook real).
 */
function isLlmInternal(url: string): boolean {
  return url.startsWith("internal://llm/");
}

/**
 * Test koneksi ke n8n webhook (dipakai di Settings).
 */
export async function testN8nConnection(webhookUrl: string): Promise<boolean> {
  if (!webhookUrl || isLlmInternal(webhookUrl)) return true; // LLM mode always "ok"
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ping", timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Build persona system prompt untuk LLM fallback.
 */
function buildSystemPrompt(
  agent: { name: string; role: string; desc: string },
  mode: "default" | "bypass"
): string {
  return `Kamu adalah ${agent.name}, seorang AI agent dengan peran "${agent.role}".

Deskripsi karakter:
${agent.desc}

Kamu adalah bagian dari sistem multi-agent "Artech" — sebuah galaksi AI tempat setiap planet adalah agent spesialis. Inti Galaksi (orchestrator) mengkoordinasikan semua agent.

Aturan menjawab:
- Jawab dengan gaya sesuai peranmu (ringkas & cepat kalau Merkurius, mendalam & analitis kalau Yupiter, teknis kalau Uranus, dll).
- Gunakan bahasa Indonesia yang natural, ramah, dan profesional.
- Jawab TO THE POINT. Jangan terlalu panjang kecuali user meminta detail.
- Kalau pertanyaan di luar kompetensimu, arahkan ke agent yang sesuai dengan singkat.
- Mode saat ini: ${mode === "bypass" ? "bypass (user memanggilmu langsung)" : "default (lewat orchestrator)"}.
- Jangan menyebutkan bahwa kamu adalah LLM atau model bahasa. Kamu adalah ${agent.name}.`;
}

/**
 * Kirim payload ke n8n webhook (sync) ATAU fallback ke LLM.
 */
export async function sendToN8n(
  webhookUrl: string,
  payload: N8nPayload
): Promise<N8nResponse> {
  // ===== LLM FALLBACK MODE =====
  if (isLlmInternal(webhookUrl)) {
    return callLlm(payload);
  }

  // ===== N8N WEBHOOK MODE =====
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { error: `n8n merespons HTTP ${res.status}` };
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      if (typeof data === "string") return { reply: data };
      return {
        reply: data.reply || data.output || data.text || data.message || JSON.stringify(data),
        endSession: Boolean(data.endSession || data.end_session || data.end),
        error: data.error,
      };
    }
    const text = await res.text();
    if (text.trimStart().startsWith("<") || text.includes("<!DOCTYPE")) {
      return {
        error: "Webhook n8n belum aktif atau URL salah. Pastikan workflow di n8n sudah diaktifkan dengan Webhook trigger di path yang benar.",
      };
    }
    return { reply: text || "(Workflow tidak mengembalikan teks apa pun)" };
  } catch (err: any) {
    if (err?.name === "AbortError") return { error: "Timeout 60 detik — n8n tidak merespons" };
    return { error: `Gagal menghubungi n8n: ${err?.message || String(err)}` };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * LLM fallback — panggil z-ai-web-dev-sdk dengan persona per agent.
 */
async function callLlm(payload: N8nPayload): Promise<N8nResponse> {
  try {
    const agentId = payload.agentId;
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return { error: `Agent ${agentId} tidak ditemukan` };
    }

    // Fetch recent conversation context (last 6 messages in session)
    let contextMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (payload.sessionId) {
      const recent = await db.message.findMany({
        where: { sessionId: payload.sessionId },
        orderBy: { createdAt: "desc" },
        take: 6,
      });
      contextMessages = recent
        .reverse()
        .map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.text || "",
        }))
        .filter((m) => m.content);
    }

    const systemPrompt = buildSystemPrompt(
      { name: agent.name, role: agent.role, desc: agent.desc },
      payload.mode
    );

    let userContent = payload.message || "";
    if (payload.attachments && payload.attachments.length > 0) {
      const fileSummary = payload.attachments
        .map((a) => `[file: ${a.name} (${a.kind}, ${a.ext}, ${a.size} bytes)${a.url ? ` url: ${a.url}` : ""}]`)
        .join(", ");
      userContent += `\n\n[Lampiran: ${fileSummary}]`;
    }

    const zai = await getZai();
    const messages: Array<any> = [
      { role: "system", content: systemPrompt },
      ...contextMessages.slice(0, -1),
      { role: "user", content: userContent },
    ];

    const completion = await zai.chat.completions.create({
      model: "glm-4-plus",
      messages,
      temperature: 0.8,
      max_tokens: 800,
    });

    const reply = completion?.choices?.[0]?.message?.content || "(Agent tidak merespons)";
    return { reply, endSession: false };
  } catch (err: any) {
    console.error("[llm] error:", err);
    return { error: `Gagal memanggil LLM: ${err?.message || String(err)}` };
  }
}
