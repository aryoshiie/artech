// n8n Bridge — the "hands" of the agent system.
// Pattern: "AI decides, n8n executes".
//
// 2 directions:
// 1. Agent → n8n: n8n_trigger tool (agent calls n8n workflow via webhook)
// 2. n8n → Agent: /webhook/n8n/:workflowName endpoint (n8n triggers agent)
//
// All SaaS API credentials (Shopee, Gumroad, WhatsApp, Google) live in n8n,
// NOT in agent-core. Agent-core only knows workflow names + payloads.
import { settings } from './settings.ts'
import { registerTool } from './tools/registry.ts'

// ---- n8n_trigger tool (agent → n8n) ----
registerTool({
  name: 'n8n_trigger',
  description:
    'Trigger an n8n workflow by name. n8n executes the actual API calls (Shopee, Gumroad, WhatsApp, Google Calendar, etc) and returns the result. ' +
    'Use this for ANY task that involves external services — store operations, sending messages, calendar events, data fetching. ' +
    'The workflow must be registered in the workflows table first. Use n8n_list_workflows to see available workflows.',
  parameters: {
    type: 'object',
    properties: {
      workflow: {
        type: 'string',
        description: 'Workflow name (must match a row in the workflows table)',
      },
      payload: {
        type: 'object',
        description: 'Input data for the workflow (varies per workflow)',
        additionalProperties: true,
      },
      wait: {
        type: 'boolean',
        description: 'If true (default), wait for workflow to complete and return result. If false, fire-and-forget.',
      },
    },
    required: ['workflow'],
  },
  async execute(args) {
    const workflowName = String(args.workflow ?? '')
    const payload = (args.payload ?? {}) as Record<string, unknown>
    const wait = args.wait !== false // default true

    if (!workflowName) return 'Error: workflow name required'

    // Look up workflow URL from Supabase (or settings for ad-hoc)
    // For now, use n8n base URL + workflow name as webhook path
    const { baseUrl, apiKey } = settings.getN8nConfig()
    if (!baseUrl) return 'Error: n8n not configured. Set n8n_base_url in settings.'

    // Common n8n webhook URL pattern: https://n8n.yourvps.com/webhook/<path>
    // The workflow name maps to the webhook path configured in n8n
    const webhookUrl = `${baseUrl.replace(/\/$/, '')}/webhook/${encodeURIComponent(workflowName)}`

    try {
      const controller = new AbortController()
      const timeoutMs = wait ? 120000 : 10000 // 2min for sync, 10s for fire-and-forget
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (apiKey) headers['X-N8N-API-KEY'] = apiKey

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return `Error: n8n workflow "${workflowName}" returned HTTP ${res.status}: ${text.slice(0, 500)}`
      }

      if (!wait) {
        return `Workflow "${workflowName}" triggered (fire-and-forget). n8n is processing.`
      }

      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const json = await res.json()
        const result = JSON.stringify(json, null, 2)
        // Truncate huge results
        return result.length > 20000 ? result.slice(0, 20000) + '\n... [truncated]' : result
      }
      const text = await res.text()
      return text.slice(0, 20000) || '[empty response from n8n]'
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return `Error: n8n workflow "${workflowName}" timed out (wait=${wait})`
      }
      return `Error triggering n8n workflow: ${err?.message ?? String(err)}`
    }
  },
})

// ---- n8n_list_workflows tool (agent introspection) ----
registerTool({
  name: 'n8n_list_workflows',
  description:
    'List available n8n workflows from the workflows table. Use this to discover what workflows the agent can trigger. ' +
    'Each workflow has a name, description, and expected input shape.',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional filter string (case-insensitive, matches name or description)',
      },
    },
  },
  async execute(args) {
    const filter = String(args.filter ?? '').toLowerCase()
    // Lazy import to avoid circular dependency
    const { workflowRegistry } = await import('./supabase.ts')
    const workflows = await workflowRegistry.list()
    if (workflows.length === 0) {
      return 'No workflows registered. Add workflows via the dashboard or ask the human to configure n8n workflows.'
    }
    const filtered = filter
      ? workflows.filter((w) =>
          w.name.toLowerCase().includes(filter) || (w.description || '').toLowerCase().includes(filter))
      : workflows
    if (filtered.length === 0) return `No workflows matching "${filter}".`
    return filtered
      .map((w, i) => `${i + 1}. **${w.name}** — ${w.description || '(no description)'}\n   URL: ${w.n8n_webhook_url}\n   Async: ${w.async_callback ? 'yes' : 'no'}`)
      .join('\n\n')
  },
})

// ---- Webhook receiver (n8n → agent) ----
// Mounted at POST /webhook/n8n/:workflowName in index.ts
export async function handleN8nWebhook(
  workflowName: string,
  body: any,
  query: any
): Promise<{ status: number; body: any }> {
  // n8n calls this endpoint to trigger an agent task.
  // Expected body: { agent: "store-manager", task: "check stock for product X", session_id?: "..." }
  // Or: { workflow_run_id: "...", result: {...} } for async callback

  // Async callback pattern (n8n returns result of a long task)
  if (body.workflow_run_id && body.result !== undefined) {
    // TODO: mark workflow_run as completed in Supabase, deliver result to waiting agent
    return { status: 200, body: { ok: true, message: 'callback received' } }
  }

  // Trigger pattern (n8n asks agent to do something)
  const agentName = body.agent || body.agent_name
  const task = body.task || body.message || body.prompt
  if (!agentName || !task) {
    return {
      status: 400,
      body: { error: 'agent and task required in body', example: { agent: 'store-manager', task: 'check stock' } },
    }
  }

  // Spawn agent to handle this task
  // For sync mode: run and return result
  // For async mode: return 202 with slotId, n8n polls or gets callback
  const async = body.async === true || body.callback_url

  // Lazy import to avoid circular dependency
  const { agentRegistry, sessionStore } = await import('./supabase.ts')
  const { SlotManager } = await import('./slot-manager.ts')

  const agent = await agentRegistry.getByName(agentName)
  if (!agent) {
    return { status: 404, body: { error: `agent "${agentName}" not found` } }
  }
  if (!agent.enabled) {
    return { status: 403, body: { error: `agent "${agentName}" is disabled` } }
  }

  // Create or reuse session
  let sessionId = body.session_id
  if (!sessionId) {
    const session = await sessionStore.create(agent.id!, task.slice(0, 60))
    sessionId = session.id
  }

  if (async) {
    // Fire-and-forget: spawn slot, return immediately
    const slot = await SlotManager.spawn({
      agentId: agent.id!,
      sessionId,
      task,
      callbackUrl: body.callback_url,
    })
    return {
      status: 202,
      body: { ok: true, slotId: slot.id, sessionId, message: 'agent spawned, will callback when done' },
    }
  }

  // Sync: run agent, wait for result, return
  const result = await SlotManager.runSync({
    agentId: agent.id!,
    sessionId,
    task,
  })
  return { status: 200, body: { ok: true, sessionId, result } }
}
