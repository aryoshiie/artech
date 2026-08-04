// Slot Manager — dynamic agent slot lifecycle.
// Hermes-inspired: spawn, kill, swap, queue, heartbeat monitor.
// Always-on (persistent) workers auto-respawn after natural completion.
//
// Slot states: idle → running → (idle | dead)
// Persistent slots: after task done, stay alive listening for next task
import { agentRegistry, slotRegistry, type AgentDefinition, type AgentSlot } from './supabase.ts'
import { Agent } from './agent.ts'
import { settings } from './settings.ts'
import type { StreamEvent } from './types.ts'

const MAX_CONCURRENT = 20 // config, can be raised

interface SpawnRequest {
  agentId: string
  sessionId: string
  task: string
  callbackUrl?: string
  onEvent?: (e: StreamEvent) => void
}

interface ActiveSlot {
  id: string
  agent: Agent
  def: AgentDefinition
  sessionId: string
  task: string
  startedAt: number
  onEvent?: (e: StreamEvent) => void
  heartbeatTimer?: ReturnType<typeof setInterval>
}

class SlotManagerClass {
  private active = new Map<string, ActiveSlot>()
  private queue: SpawnRequest[] = []
  private heartbeatMonitor?: ReturnType<typeof setInterval>

  constructor() {
    // Start heartbeat monitor (every 30s, check for stale slots)
    this.heartbeatMonitor = setInterval(() => this.checkStaleSlots(), 30000)
  }

  // ---- Spawn a new slot ----
  async spawn(req: SpawnRequest): Promise<{ id: string; status: string }> {
    const def = await agentRegistry.get(req.agentId)
    if (!def) throw new Error(`agent ${req.agentId} not found`)
    if (!def.enabled) throw new Error(`agent ${def.name} is disabled`)

    // Check capacity
    if (this.active.size >= MAX_CONCURRENT) {
      this.queue.push(req)
      return { id: 'queued', status: 'queued' }
    }

    // Create slot record in DB
    const slotRow = await slotRegistry.create(req.agentId, req.sessionId, req.task)
    const slotId = slotRow.id

    // Build agent instance
    const agent = new Agent({
      id: req.sessionId,
      title: req.task.slice(0, 60),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workingDir: def.working_dir || process.cwd(),
      model: def.model || 'glm-4.6',
      provider: def.provider || 'zai',
    })

    const active: ActiveSlot = {
      id: slotId,
      agent,
      def,
      sessionId: req.sessionId,
      task: req.task,
      startedAt: Date.now(),
      onEvent: req.onEvent,
    }

    // Heartbeat: update DB every 10s while running
    active.heartbeatTimer = setInterval(() => {
      slotRegistry.heartbeat(slotId).catch(() => {})
    }, 10000)

    this.active.set(slotId, active)
    return { id: slotId, status: 'running' }
  }

  // ---- Run agent synchronously (for n8n sync mode + dashboard chat) ----
  async runSync(req: SpawnRequest): Promise<string> {
    const { id: slotId } = await this.spawn(req)
    if (slotId === 'queued') {
      // Wait for queue to drain (simplified — for production, use proper async queue)
      return 'Error: max concurrent slots reached, task queued. Try again later or use async mode.'
    }

    const active = this.active.get(slotId)
    if (!active) return 'Error: slot not found after spawn'

    let finalContent = ''
    const onEvent = (e: StreamEvent) => {
      if (e.type === 'token') finalContent += e.value
      active.onEvent?.(e)
    }

    try {
      await active.agent.runTurn(req.task, onEvent)
      await slotRegistry.setStatus(slotId, 'idle')
    } catch (err: any) {
      await slotRegistry.setStatus(slotId, 'dead')
      finalContent = `Error: ${err?.message ?? String(err)}`
    } finally {
      this.cleanup(slotId)
    }

    // Persistent slots auto-respawn (for always-on workers)
    if (active.def.slot_mode === 'persistent') {
      // For now, persistent slots just stay in 'idle' state in DB.
      // A task queue (message queue) would deliver the next task.
      // TODO: implement persistent worker task queue
    }

    return finalContent
  }

  // ---- Kill a slot (user stop, admin kill) ----
  async kill(slotId: string): Promise<void> {
    const active = this.active.get(slotId)
    if (active) {
      active.agent.interrupt()
    }
    await slotRegistry.setStatus(slotId, 'dead')
    this.cleanup(slotId)
  }

  // ---- List active slots ----
  listActive(): Array<{
    id: string
    agentName: string
    task: string
    status: string
    uptime: number
  }> {
    return Array.from(this.active.values()).map((a) => ({
      id: a.id,
      agentName: a.def.name,
      task: a.task.slice(0, 80),
      status: 'running',
      uptime: Date.now() - a.startedAt,
    }))
  }

  // ---- Check for stale slots (heartbeat timeout > 120s) ----
  private async checkStaleSlots() {
    for (const [slotId, active] of this.active.entries()) {
      const now = Date.now()
      if (now - active.startedAt > 1800000) { // 30min max runtime
        console.log(`[slot-manager] killing stale slot ${slotId} (30min timeout)`)
        await this.kill(slotId)
      }
    }
  }

  // ---- Cleanup slot resources ----
  private cleanup(slotId: string) {
    const active = this.active.get(slotId)
    if (active?.heartbeatTimer) clearInterval(active.heartbeatTimer)
    this.active.delete(slotId)
    // Drain queue
    if (this.queue.length > 0 && this.active.size < MAX_CONCURRENT) {
      const next = this.queue.shift()!
      this.spawn(next).catch((err) => console.error('[slot-manager] queue spawn error:', err))
    }
  }
}

export const SlotManager = new SlotManagerClass()
