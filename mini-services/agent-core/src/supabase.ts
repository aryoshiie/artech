// Supabase client wrapper — reads credentials from settings.ts (local config.db).
// Falls back to SQLite (state.ts) when Supabase is not configured.
// This lets the dashboard work in "setup mode" before credentials are entered.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { settings } from './settings.ts'

let client: SupabaseClient | null = null
let lastConfigHash = ''

function getConfigHash(): string {
  const c = settings.getSupabaseConfig()
  return `${c.url}|${c.anonKey}|${c.serviceRoleKey}`
}

export function getSupabase(): SupabaseClient | null {
  const config = settings.getSupabaseConfig()
  if (!config.url || !config.serviceRoleKey) return null

  const hash = getConfigHash()
  if (hash !== lastConfigHash) {
    // Recreate client if config changed (e.g., user updated credentials)
    client = createClient(config.url, config.anonKey || config.serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${config.serviceRoleKey}` } },
    })
    lastConfigHash = hash
  }
  return client
}

export function isSupabaseReady(): boolean {
  return getSupabase() !== null
}

// ---- Agent Registry (CRUD on agents table) ----
export interface AgentDefinition {
  id?: string
  name: string
  description?: string
  model?: string
  provider?: string
  system_prompt?: string
  tool_whitelist?: string[]
  skill_whitelist?: string[]
  memory_scope?: 'global' | 'agent' | 'none'
  working_dir?: string
  max_iterations?: number
  temperature?: number
  slot_mode?: 'persistent' | 'ondemand' | 'interactive'
  enabled?: boolean
  metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export const agentRegistry = {
  async list(): Promise<AgentDefinition[]> {
    const sb = getSupabase()
    if (!sb) return []
    const { data, error } = await sb.from('agents').select('*').order('name')
    if (error) throw new Error(`list agents: ${error.message}`)
    return data as AgentDefinition[]
  },

  async get(id: string): Promise<AgentDefinition | null> {
    const sb = getSupabase()
    if (!sb) return null
    const { data, error } = await sb.from('agents').select('*').eq('id', id).single()
    if (error) throw new Error(`get agent: ${error.message}`)
    return data as AgentDefinition
  },

  async getByName(name: string): Promise<AgentDefinition | null> {
    const sb = getSupabase()
    if (!sb) return null
    const { data, error } = await sb.from('agents').select('*').eq('name', name).single()
    if (error) return null
    return data as AgentDefinition
  },

  async create(def: Partial<AgentDefinition>): Promise<AgentDefinition> {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase not configured')
    const { data, error } = await sb.from('agents').insert(def).select().single()
    if (error) throw new Error(`create agent: ${error.message}`)
    return data as AgentDefinition
  },

  async update(id: string, patch: Partial<AgentDefinition>): Promise<AgentDefinition> {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase not configured')
    const { data, error } = await sb.from('agents').update(patch).eq('id', id).select().single()
    if (error) throw new Error(`update agent: ${error.message}`)
    return data as AgentDefinition
  },

  async delete(id: string): Promise<void> {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase not configured')
    const { error } = await sb.from('agents').delete().eq('id', id)
    if (error) throw new Error(`delete agent: ${error.message}`)
  },
}

// ---- Slot Registry (runtime, agent_slots table) ----
export interface AgentSlot {
  id: string
  agent_id: string
  session_id: string | null
  status: 'idle' | 'running' | 'waiting' | 'dead'
  task: string | null
  started_at: string
  last_heartbeat: string
  pid: number | null
  metadata: Record<string, unknown>
}

export const slotRegistry = {
  async list(): Promise<AgentSlot[]> {
    const sb = getSupabase()
    if (!sb) return []
    const { data, error } = await sb.from('agent_slots')
      .select('*').order('started_at', { ascending: false }).limit(50)
    if (error) throw new Error(`list slots: ${error.message}`)
    return data as AgentSlot[]
  },

  async create(agentId: string, sessionId: string | null, task: string | null): Promise<AgentSlot> {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase not configured')
    const { data, error } = await sb.from('agent_slots').insert({
      agent_id: agentId, session_id: sessionId, status: 'running', task,
    }).select().single()
    if (error) throw new Error(`create slot: ${error.message}`)
    return data as AgentSlot
  },

  async heartbeat(slotId: string): Promise<void> {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('agent_slots').update({ last_heartbeat: new Date().toISOString() }).eq('id', slotId)
  },

  async setStatus(slotId: string, status: AgentSlot['status']): Promise<void> {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('agent_slots').update({ status }).eq('id', slotId)
  },

  async delete(slotId: string): Promise<void> {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('agent_slots').delete().eq('id', slotId)
  },
}

// ---- Sessions (Supabase-backed, replaces state.ts when configured) ----
export interface SessionRow {
  id: string
  agent_id: string
  title: string
  working_dir: string | null
  status: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const sessionStore = {
  async list(agentId: string | null, limit = 50): Promise<SessionRow[]> {
    const sb = getSupabase()
    if (!sb) return []
    let q = sb.from('sessions').select('*').order('updated_at', { ascending: false }).limit(limit)
    if (agentId) q = q.eq('agent_id', agentId)
    const { data, error } = await q
    if (error) throw new Error(`list sessions: ${error.message}`)
    return data as SessionRow[]
  },

  async create(agentId: string, title?: string, workingDir?: string): Promise<SessionRow> {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase not configured')
    const { data, error } = await sb.from('sessions').insert({
      agent_id: agentId, title: title || 'New Session', working_dir: workingDir,
    }).select().single()
    if (error) throw new Error(`create session: ${error.message}`)
    return data as SessionRow
  },

  async get(id: string): Promise<SessionRow | null> {
    const sb = getSupabase()
    if (!sb) return null
    const { data, error } = await sb.from('sessions').select('*').eq('id', id).single()
    if (error) return null
    return data as SessionRow
  },

  async updateTitle(id: string, title: string): Promise<void> {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('sessions').update({ title }).eq('id', id)
  },

  async delete(id: string): Promise<void> {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('sessions').delete().eq('id', id)
  },
}

// ---- Messages (Supabase-backed) ----
export interface MessageRow {
  id: string
  session_id: string
  role: string
  content: string | null
  tool_calls: unknown
  tool_call_id: string | null
  tool_name: string | null
  cost_usd: number | null
  created_at: string
}

export const messageStore = {
  async list(sessionId: string): Promise<MessageRow[]> {
    const sb = getSupabase()
    if (!sb) return []
    const { data, error } = await sb.from('messages')
      .select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
    if (error) throw new Error(`list messages: ${error.message}`)
    return data as MessageRow[]
  },

  async add(msg: Omit<MessageRow, 'id' | 'created_at'>): Promise<MessageRow> {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase not configured')
    const { data, error } = await sb.from('messages').insert(msg).select().single()
    if (error) throw new Error(`add message: ${error.message}`)
    return data as MessageRow
  },
}

// ---- FTS Search ----
export const search = {
  async messages(query: string, limit = 20): Promise<Array<{ id: string; session_id: string; role: string; content: string; created_at: string }>> {
    const sb = getSupabase()
    if (!sb) return []
    // Use Postgres FTS via RPC function (need to create the function in Supabase)
    // For now, use simple ILIKE fallback
    const { data, error } = await sb.from('messages')
      .select('id, session_id, role, content, created_at')
      .ilike('content', `%${query}%`)
      .neq('role', 'tool')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return data as any[]
  },
}
