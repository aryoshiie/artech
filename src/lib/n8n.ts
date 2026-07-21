// src/lib/n8n.ts — n8n webhook client + URL helpers
// Webapp → n8n: sync POST ke orchestrator webhook (atau langsung ke agent webhook kalau bypass)

import { db } from "./db";

/**
 * Dapatkan webhook URL untuk agent tertentu.
 * Prioritas:
 *   1. agent.webhookUrl (kalau di-set per agent)
 *   2. settings.webhookUrl (orchestrator fallback)
 *   3. Generate dari pattern: {N8N_BASE_URL}/webhook/agent-{agentId}
 */
export async function getAgentWebhookUrl(agentId: string): Promise<string | null> {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (agent?.webhookUrl) return agent.webhookUrl;

  const settings = await db.settings.findUnique({ where: { id: "singleton" } });
  if (agent?.isCore && settings?.webhookUrl) return settings.webhookUrl;
  if (settings?.n8nBaseUrl) {
    return `${settings.n8nBaseUrl.replace(/\/$/, "")}/webhook/agent-${agentId}`;
  }
  if (settings?.webhookUrl) return settings.webhookUrl;
  return null;
}

/**
 * Generate webhook URL untuk agent baru (dipakai di AddAgentModal & Tambah Agent flow).
 * Pattern: {N8N_BASE_URL}/webhook/agent-{agentId}
 */
export async function generateWebhookUrl(agentId: string): Promise<string> {
  const settings = await db.settings.findUnique({ where: { id: "singleton" } });
  const base = (settings?.n8nBaseUrl || process.env.N8N_BASE_URL || "https://artha.loophole.site").replace(/\/$/, "");
  return `${base}/webhook/agent-${agentId}`;
}

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
    url?: string;          // URL Supabase Storage (kalau file besar)
    content?: string;      // base64 (kalau file kecil / gambar)
  }>;
  timestamp: string;
}

export interface N8nResponse {
  reply?: string;
  output?: string;
  text?: string;
  message?: string;
  endSession?: boolean;    // sinyal dari agent untuk akhiri sesi (routing lapis 1)
  error?: string;
}

/**
 * Kirim payload ke n8n webhook, tunggu response (sync mode).
 */
export async function sendToN8n(webhookUrl: string, payload: N8nPayload): Promise<N8nResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout
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
      // n8n bisa return string atau object
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

/**
 * Test koneksi ke n8n webhook (dipakai di Settings).
 */
export async function testN8nConnection(webhookUrl: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ping", timestamp: new Date().toISOString() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
