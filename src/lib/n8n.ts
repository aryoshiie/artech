// src/lib/n8n.ts — n8n webhook client ONLY (z-ai SDK fallback REMOVED).
// Jika agent tidak punya webhook URL → return error (agent belum dikonfigurasi).
// Reason: z-ai-web-dev-sdk hanya jalan di sandbox Z.ai, tidak di production server.

import { db } from "./db";

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

/**
 * Dapatkan webhook URL untuk agent.
 * Prioritas:
 *   1. agent.webhookUrl (kalau di-set & URL http real → n8n mode)
 *   2. settings.n8nBaseUrl → generate pattern {baseUrl}/webhook/agent-{agentId}
 *   3. settings.webhookUrl (untuk orchestrator/core)
 *   4. Return null (agent belum dikonfigurasi → error)
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

  // Tidak ada webhook → return null (akan return error di sendToN8n)
  return null;
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
 * Test koneksi ke n8n webhook (dipakai di Settings).
 */
export async function testN8nConnection(webhookUrl: string): Promise<boolean> {
  if (!webhookUrl || !/^https?:\/\//.test(webhookUrl)) return false;
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
 * Kirim payload ke n8n webhook (sync).
 * Jika webhook URL tidak ada → return error "agent belum dikonfigurasi".
 */
export async function sendToN8n(
  webhookUrl: string,
  payload: N8nPayload
): Promise<N8nResponse> {
  // Validasi webhook URL
  if (!webhookUrl || !/^https?:\/\//.test(webhookUrl)) {
    return {
      error: `Agent "${payload.agentName}" belum dikonfigurasi. Set webhook URL ke n8n workflow di pengaturan agent.`,
    };
  }

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
    // Deteksi HTML response (biasanya landing page loophole/n8n, bukan workflow response)
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
