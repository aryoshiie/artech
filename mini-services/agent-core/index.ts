// Agent Core HTTP API — Bun.serve on port 3030.
//
// Endpoints:
//   ---- Health & Settings ----
//   GET  /health               — health check
//   GET  /settings/status      — what's configured
//   GET  /settings             — list setting keys (no secret values)
//   POST /settings             — save credentials/config
//   POST /settings/test        — test connection (supabase|n8n|llm)
//
//   ---- Agents (registry CRUD) ----
//   GET  /agents               — list all agent definitions
//   GET  /agents/:id           — get one agent
//   POST /agents               — create agent
//   PATCH /agents/:id          — update agent
//   DELETE /agents/:id         — delete agent
//
//   ---- Slots (runtime) ----
//   GET  /slots                — list active slots
//   POST /slots/:id/kill       — kill a slot
//   POST /agents/:id/run       — run agent sync (returns result)
//   POST /agents/:id/trigger   — run agent async (returns slotId)
//
//   ---- Chat (SSE, backward compat with existing dashboard) ----
//   POST /chat                 — send message, stream response via SSE
//   POST /chat/stop            — interrupt current turn
//
//   ---- Sessions ----
//   GET  /sessions             — list sessions (optional ?agent_id=)
//   POST /sessions             — create session (body: {agent_id, title?, working_dir?})
//   GET  /sessions/:id         — get session + messages
//   DELETE /sessions/:id       — delete session
//
//   ---- Skills & Tools ----
//   GET  /skills               — list skills
//   GET  /tools                — list tools
//   GET  /search?q=            — search messages
//
//   ---- n8n Bridge ----
//   POST /webhook/n8n/:name    — n8n triggers agent (body: {agent, task, async?})
import { Agent, type AgentConfigOverride } from './src/agent.ts'
import { state } from './src/state.ts'
import { listInstalledSkills } from './src/tools/skills.ts'
import { listTools, discoverTools } from './src/tools/registry.ts'
import { refreshMemorySnapshot } from './src/memory/store.ts'
import { settings } from './src/settings.ts'
import {
  agentRegistry, sessionStore, messageStore, search as searchStore,
  isSupabaseReady,
} from './src/supabase.ts'
import { SlotManager } from './src/slot-manager.ts'
import { handleN8nWebhook } from './src/n8n-bridge.ts'

const PORT = 3030

// Track active agents per session (legacy, for /chat/stop backward compat)
const activeAgents = new Map<string, Agent>()

await discoverTools()
refreshMemorySnapshot()

function json(res: any, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function cors(res: Response): Response {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return res
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method

  if (method === 'OPTIONS') return cors(new Response(null, { status: 204 }))

  // ---- Health ----
  if (path === '/health') {
    return cors(json({
      ok: true, port: PORT, time: Date.now(),
      supabase: isSupabaseReady(),
    }))
  }

  // ===== SETTINGS =====
  if (path === '/settings/status' && method === 'GET') {
    return cors(json(settings.getStatus()))
  }

  if (path === '/settings' && method === 'GET') {
    return cors(json({ settings: settings.list() }))
  }

  if (path === '/settings' && method === 'POST') {
    const body = await req.json().catch(() => ({}))
    // Expected: { supabase_url, supabase_anon_key, supabase_service_role_key, n8n_base_url, n8n_api_key, llm_provider, llm_api_key, llm_model }
    const secretKeys = new Set(['supabase_anon_key', 'supabase_service_role_key', 'n8n_api_key', 'llm_api_key'])
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === 'string' && v.trim()) {
        settings.set(k, v.trim(), secretKeys.has(k))
      }
    }
    return cors(json({ ok: true, status: settings.getStatus() }))
  }

  if (path === '/settings/test' && method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const service = String(body.service ?? '')
    if (!['supabase', 'n8n', 'llm'].includes(service)) {
      return cors(json({ error: 'service must be supabase|n8n|llm' }, 400))
    }
    const result = await settings.testConnection(service as any)
    return cors(json(result))
  }

  // ===== AGENTS (CRUD) =====
  if (path === '/agents' && method === 'GET') {
    if (!isSupabaseReady()) return cors(json({ agents: [], error: 'Supabase not configured' }))
    try {
      const agents = await agentRegistry.list()
      return cors(json({ agents }))
    } catch (e: any) {
      return cors(json({ error: e.message }, 500))
    }
  }

  if (path === '/agents' && method === 'POST') {
    if (!isSupabaseReady()) return cors(json({ error: 'Supabase not configured' }, 400))
    try {
      const body = await req.json()
      const agent = await agentRegistry.create(body)
      return cors(json({ agent }, 201))
    } catch (e: any) {
      return cors(json({ error: e.message }, 500))
    }
  }

  const agentMatch = path.match(/^\/agents\/([\w-]+)$/)
  if (agentMatch) {
    const id = agentMatch[1]
    if (method === 'GET') {
      try {
        const agent = await agentRegistry.get(id)
        if (!agent) return cors(json({ error: 'not found' }, 404))
        return cors(json({ agent }))
      } catch (e: any) { return cors(json({ error: e.message }, 500)) }
    }
    if (method === 'PATCH') {
      try {
        const body = await req.json()
        const agent = await agentRegistry.update(id, body)
        return cors(json({ agent }))
      } catch (e: any) { return cors(json({ error: e.message }, 500)) }
    }
    if (method === 'DELETE') {
      try {
        await agentRegistry.delete(id)
        return cors(json({ ok: true }))
      } catch (e: any) { return cors(json({ error: e.message }, 500)) }
    }
  }

  // Run agent sync: POST /agents/:id/run
  const runMatch = path.match(/^\/agents\/([\w-]+)\/run$/)
  if (runMatch && method === 'POST') {
    const agentId = runMatch[1]
    if (!isSupabaseReady()) return cors(json({ error: 'Supabase not configured' }, 400))
    try {
      const body = await req.json()
      const task = String(body.task ?? '')
      if (!task) return cors(json({ error: 'task required' }, 400))

      // Create session if not provided
      let sessionId = body.session_id
      if (!sessionId) {
        const session = await sessionStore.create(agentId, task.slice(0, 60))
        sessionId = session.id
      }

      const result = await SlotManager.runSync({
        agentId, sessionId, task,
        onEvent: body.stream ? undefined : undefined, // no SSE for sync run
      })
      return cors(json({ ok: true, sessionId, result }))
    } catch (e: any) { return cors(json({ error: e.message }, 500)) }
  }

  // Trigger agent async: POST /agents/:id/trigger
  const triggerMatch = path.match(/^\/agents\/([\w-]+)\/trigger$/)
  if (triggerMatch && method === 'POST') {
    const agentId = triggerMatch[1]
    if (!isSupabaseReady()) return cors(json({ error: 'Supabase not configured' }, 400))
    try {
      const body = await req.json()
      const task = String(body.task ?? '')
      if (!task) return cors(json({ error: 'task required' }, 400))

      let sessionId = body.session_id
      if (!sessionId) {
        const session = await sessionStore.create(agentId, task.slice(0, 60))
        sessionId = session.id
      }

      const slot = await SlotManager.spawn({
        agentId, sessionId, task,
        callbackUrl: body.callback_url,
      })
      return cors(json({ ok: true, slotId: slot.id, sessionId, status: slot.status }, 202))
    } catch (e: any) { return cors(json({ error: e.message }, 500)) }
  }

  // ===== SLOTS =====
  if (path === '/slots' && method === 'GET') {
    const active = SlotManager.listActive()
    return cors(json({ slots: active }))
  }

  const killMatch = path.match(/^\/slots\/([\w-]+)\/kill$/)
  if (killMatch && method === 'POST') {
    await SlotManager.kill(killMatch[1])
    return cors(json({ ok: true }))
  }

  // ===== n8n WEBHOOK =====
  const n8nMatch = path.match(/^\/webhook\/n8n\/([\w-]+)$/)
  if (n8nMatch && method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const result = await handleN8nWebhook(n8nMatch[1], body, Object.fromEntries(url.searchParams))
    return cors(json(result.body, result.status))
  }

  // ===== RUN-TASK (custom config, no Supabase registry needed) =====
  // POST /run-task        — sync: returns final result string
  // POST /run-task/stream — SSE stream of agent loop events
  //
  // Body: { agentId, task, systemPrompt?, toolWhitelist?, maxIterations?, temperature?, sessionId? }
  //
  // These endpoints create an Agent instance on-the-fly with the provided
  // config (systemPrompt, toolWhitelist, etc.) WITHOUT needing the agent to
  // exist in agent-core's Supabase registry. This is the key integration
  // point — artech agents live in Prisma, but agent-core runs them with
  // passed config.
  if ((path === '/run-task' || path === '/run-task/stream') && method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const task = String(body.task ?? '').trim()
    const agentId = String(body.agentId ?? 'artech').trim()
    if (!task) return cors(json({ error: 'task required' }, 400))

    const configOverride: AgentConfigOverride = {}
    if (typeof body.systemPrompt === 'string' && body.systemPrompt.trim()) {
      configOverride.systemPrompt = body.systemPrompt
    }
    if (Array.isArray(body.toolWhitelist) && body.toolWhitelist.length > 0) {
      configOverride.toolWhitelist = body.toolWhitelist
        .map((t: any) => String(t).trim())
        .filter(Boolean)
    }
    if (typeof body.maxIterations === 'number' && body.maxIterations > 0) {
      configOverride.maxIterations = Math.min(100, Math.floor(body.maxIterations))
    }
    if (typeof body.temperature === 'number' && body.temperature >= 0 && body.temperature <= 2) {
      configOverride.temperature = body.temperature
    }

    // Use provided sessionId, else create a local SQLite session.
    // NOTE: these sessions live in agent-core's data/agent.db (not Supabase),
    // which is fine for ad-hoc task runs from the artech dashboard.
    let sessionId = body.sessionId ? String(body.sessionId) : ''
    if (!sessionId || !state.getSession(sessionId)) {
      const session = state.createSession({
        title: `[${agentId}] ${task.slice(0, 50)}`,
        workingDir: process.cwd(),
      })
      sessionId = session.id
    }

    const agent = new Agent(
      state.getSession(sessionId)!,
      undefined,
      Object.keys(configOverride).length > 0 ? configOverride : undefined,
    )

    // ---- SSE streaming variant ----
    if (path === '/run-task/stream') {
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder()
          const send = (e: any) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))
          let finalContent = ''
          const wrappedSend = (e: any) => {
            if (e.type === 'token') finalContent += e.value
            send(e)
          }
          try {
            await agent.runTurn(task, wrappedSend)
            send({ type: 'result', result: finalContent, sessionId })
          } catch (err: any) {
            send({ type: 'error', message: err?.message ?? String(err) })
          } finally {
            controller.close()
          }
        },
        cancel() {
          agent.interrupt()
        },
      })
      return new Response(stream, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          'connection': 'keep-alive',
          'x-accel-buffering': 'no',
          'access-control-allow-origin': '*',
        },
      })
    }

    // ---- Sync variant: collect tokens, return final result ----
    try {
      let finalContent = ''
      await agent.runTurn(task, (e) => {
        if (e.type === 'token') finalContent += e.value
      })
      return cors(json({ ok: true, sessionId, result: finalContent }))
    } catch (e: any) {
      return cors(json({ ok: false, error: e?.message ?? String(e), sessionId }, 500))
    }
  }

  // ===== SESSIONS (Supabase or SQLite fallback) =====
  if (path === '/sessions' && method === 'GET') {
    if (isSupabaseReady()) {
      const agentId = url.searchParams.get('agent_id')
      const sessions = await sessionStore.list(agentId)
      return cors(json({ sessions, total: sessions.length }))
    }
    // SQLite fallback
    return cors(json(state.listSessions()))
  }

  if (path === '/sessions' && method === 'POST') {
    const body = await req.json().catch(() => ({}))
    if (isSupabaseReady()) {
      if (!body.agent_id) return cors(json({ error: 'agent_id required' }, 400))
      const session = await sessionStore.create(body.agent_id, body.title, body.working_dir)
      return cors(json({ session }, 201))
    }
    // SQLite fallback
    const session = state.createSession({ title: body.title, workingDir: body.working_dir })
    return cors(json({ session }, 201))
  }

  const sessionMatch = path.match(/^\/sessions\/([\w-]+)$/)
  if (sessionMatch) {
    const id = sessionMatch[1]
    if (method === 'GET') {
      if (isSupabaseReady()) {
        const session = await sessionStore.get(id)
        if (!session) return cors(json({ error: 'not found' }, 404))
        const messages = await messageStore.list(id)
        return cors(json({ session, messages }))
      }
      const session = state.getSession(id)
      if (!session) return cors(json({ error: 'not found' }, 404))
      return cors(json({ session, messages: state.listMessages(id) }))
    }
    if (method === 'DELETE') {
      if (isSupabaseReady()) await sessionStore.delete(id)
      else state.deleteSession(id)
      return cors(json({ ok: true }))
    }
  }

  // ===== CHAT (SSE, backward compat) =====
  if (path === '/chat' && method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const sessionId = String(body.sessionId ?? '')
    const message = String(body.message ?? '')
    if (!sessionId || !message) return cors(json({ error: 'sessionId and message required' }, 400))

    // Use legacy SQLite session for now (Supabase session chat will be added
    // when dashboard is updated to pass agent_id)
    const session = state.getSession(sessionId)
    if (!session) return cors(json({ error: 'session not found' }, 404))

    const agent = new Agent(session)
    activeAgents.set(sessionId, agent)

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        const send = (e: any) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))
        try {
          await agent.runTurn(message, send)
        } catch (err: any) {
          send({ type: 'error', message: err?.message ?? String(err) })
        } finally {
          activeAgents.delete(sessionId)
          controller.close()
        }
      },
      cancel() {
        agent.interrupt()
        activeAgents.delete(sessionId)
      },
    })

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no',
      },
    })
  }

  if (path === '/chat/stop' && method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const sessionId = String(body.sessionId ?? '')
    const agent = activeAgents.get(sessionId)
    if (agent) {
      agent.interrupt()
      return cors(json({ ok: true }))
    }
    return cors(json({ ok: false, message: 'no active turn' }, 404))
  }

  // ===== SKILLS & TOOLS =====
  if (path === '/skills' && method === 'GET') {
    return cors(json({ skills: listInstalledSkills() }))
  }

  if (path === '/tools' && method === 'GET') {
    return cors(json({ tools: listTools().map((t) => ({ name: t.name, description: t.description })) }))
  }

  if (path === '/search' && method === 'GET') {
    const q = url.searchParams.get('q') ?? ''
    if (!q) return cors(json({ results: [] }))
    if (isSupabaseReady()) {
      const results = await searchStore.messages(q)
      return cors(json({ results }))
    }
    return cors(json({ results: state.search(q) }))
  }

  return cors(json({ error: 'not found', path }, 404))
}

const server = Bun.serve({
  port: PORT,
  fetch: handle,
  maxRequestBodySize: 10 * 1024 * 1024,
})

console.log(`🧠 Agent Core listening on http://localhost:${PORT}`)
console.log(`   Settings: GET/POST /settings, GET /settings/status, POST /settings/test`)
console.log(`   Agents:   GET/POST /agents, GET/PATCH/DELETE /agents/:id`)
console.log(`   Run:      POST /agents/:id/run (sync), /agents/:id/trigger (async)`)
console.log(`   Slots:    GET /slots, POST /slots/:id/kill`)
console.log(`   n8n:      POST /webhook/n8n/:name`)
console.log(`   Run Task: POST /run-task (sync), POST /run-task/stream (SSE)`)
console.log(`   Chat:     POST /chat (SSE), POST /chat/stop`)
console.log(`   Sessions: GET/POST /sessions, GET/DELETE /sessions/:id`)
console.log(`   Skills:   GET /skills`)
console.log(`   Tools:    GET /tools`)
console.log(`   Search:   GET /search?q=...`)

process.on('SIGTERM', () => { server.stop(); process.exit(0) })
process.on('SIGINT', () => { server.stop(); process.exit(0) })
