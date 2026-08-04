// src/lib/agent-core.ts — Next.js client for the agent-core mini-service (port 3030).
//
// All calls go through Next.js rewrites (next.config.ts) — relative paths only.
// The rewrite maps `/agent-core/:path*` → `${AGENT_CORE_URL || http://localhost:3030}/:path*`
// so we never reference localhost:3030 from client or server code; everything
// stays on relative paths and the gateway/rewrite handles forwarding.
//
// Two execution modes:
//   - runAgent(req)            — sync: returns final result string (POST /agent-core/run-task)
//   - runAgentStream(req, onEvent) — SSE: streams agent loop events (POST /agent-core/run-task/stream)

import { db } from "./db";

const AGENT_CORE_BASE =
  process.env.AGENT_CORE_URL ||
  process.env.NEXT_PUBLIC_AGENT_CORE_URL ||
  "http://localhost:3030";

export interface AgentCoreHealth {
  ok: boolean;
  port: number;
  time?: number;
  supabase: boolean;
}

export interface RunAgentRequest {
  /** artech agent.id (e.g. "mercury") — used for session labeling only */
  agentId: string;
  task: string;
  /** optional artech session id; if absent, agent-core creates a local one */
  sessionId?: string;
  systemPrompt?: string;
  toolWhitelist?: string[];
  maxIterations?: number;
  temperature?: number;
}

export interface RunAgentResult {
  ok: boolean;
  sessionId?: string;
  result: string;
  error?: string;
}

/**
 * Health check — 3s timeout. Returns null if agent-core is unreachable
 * (so the UI can render a clear "start agent-core" message).
 *
 * Server-side only. Don't import this from client components — call the
 * /api/agent-core/run proxy instead, or use the client-side health hook
 * that fetches `/agent-core/health` directly via the rewrite.
 */
export async function checkAgentCoreHealth(): Promise<AgentCoreHealth | null> {
  try {
    const res = await fetch(`${AGENT_CORE_BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ok: Boolean(data.ok),
      port: Number(data.port) || 3030,
      time: data.time,
      supabase: Boolean(data.supabase),
    };
  } catch {
    return null;
  }
}

/**
 * Sync run — POST /run-task on agent-core. Returns the final result string.
 * Use this for short, low-latency tasks. For long-running tasks with UI
 * feedback, use runAgentStream() instead.
 *
 * Server-side only (called from /api/agent-core/run route handler).
 */
export async function runAgent(req: RunAgentRequest): Promise<RunAgentResult> {
  try {
    const res = await fetch(`${AGENT_CORE_BASE}/run-task`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: req.agentId,
        task: req.task,
        sessionId: req.sessionId,
        systemPrompt: req.systemPrompt,
        toolWhitelist: req.toolWhitelist,
        maxIterations: req.maxIterations,
        temperature: req.temperature,
      }),
      signal: AbortSignal.timeout(120_000), // 2 min for tool loops
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        result: "",
        error: (err && err.error) || `HTTP ${res.status}`,
      };
    }
    const data = await res.json();
    return {
      ok: Boolean(data.ok),
      sessionId: data.sessionId,
      result: data.result ?? "",
      error: data.error,
    };
  } catch (err: any) {
    return {
      ok: false,
      result: "",
      error: err?.message || String(err),
    };
  }
}

/**
 * SSE streaming run — POST /run-task/stream on agent-core.
 * Calls onEvent for each SSE event: token, tool_call_start, tool_call_end,
 * message_end, turn_end, result, error.
 *
 * Returns when the stream ends. Caller can pass an AbortSignal via the
 * optional `signal` param to interrupt the agent (e.g. when the user
 * clicks "Stop").
 */
export async function runAgentStream(
  req: RunAgentRequest,
  onEvent: (e: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${AGENT_CORE_BASE}/run-task/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      agentId: req.agentId,
      task: req.task,
      sessionId: req.sessionId,
      systemPrompt: req.systemPrompt,
      toolWhitelist: req.toolWhitelist,
      maxIterations: req.maxIterations,
      temperature: req.temperature,
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of rawEvent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload));
        } catch {
          // ignore malformed lines (agent-core may emit keep-alive comments)
        }
      }
    }
  }
}

/**
 * Build a default system prompt for an artech agent when `systemPrompt`
 * isn't explicitly set in the DB. Mirrors the persona builder in
 * src/lib/n8n.ts so the LLM fallback path and the agent-core path
 * produce consistent personas.
 */
export function buildDefaultSystemPrompt(
  agent: { name: string; role: string; desc: string },
  mode: "default" | "bypass" = "default",
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
- Jangan menyebutkan bahwa kamu adalah LLM atau model bahasa. Kamu adalah ${agent.name}.

Kamu memiliki tools (shell_exec, file_read/write/list, http_fetch, memory_save/read, skill_read, n8n_trigger, n8n_list_workflows). Pakai tools kalau membantu menyelesaikan tugas lebih cepat dan akurat.`;
}

/**
 * Convenience: load an artech agent from Prisma and build a RunAgentRequest
 * from its config. Returns null if the agent doesn't exist.
 */
export async function buildRunRequestFromAgentId(
  agentId: string,
  task: string,
  mode: "default" | "bypass" = "default",
  sessionId?: string,
): Promise<RunAgentRequest | null> {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) return null;

  const toolWhitelist = (agent.toolWhitelist || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    agentId: agent.id,
    task,
    sessionId,
    systemPrompt:
      agent.systemPrompt?.trim() ||
      buildDefaultSystemPrompt(
        { name: agent.name, role: agent.role, desc: agent.desc },
        mode,
      ),
    toolWhitelist: toolWhitelist.length > 0 ? toolWhitelist : undefined,
    maxIterations: agent.maxIterations || 25,
    temperature: agent.temperature ?? 0.7,
  };
}
