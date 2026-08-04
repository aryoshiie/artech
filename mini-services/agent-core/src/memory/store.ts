// Memory store — Hermes-inspired frozen-snapshot pattern.
// MEMORY.md = agent's notes about the world / tasks / facts.
// USER.md = agent's notes about the user (preferences, context).
// Snapshot is loaded once per session and never mutated mid-turn
// to preserve LLM prompt caching.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { registerTool } from '../tools/registry.ts'

const MEMORY_DIR = join(import.meta.dir, '..', '..', 'data', 'memories')
const MEMORY_FILE = join(MEMORY_DIR, 'MEMORY.md')
const USER_FILE = join(MEMORY_DIR, 'USER.md')

mkdirSync(MEMORY_DIR, { recursive: true })

function readFileSafe(path: string): string {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : ''
  } catch {
    return ''
  }
}

// Frozen snapshot — set at agent init, used for system prompt.
let memorySnapshot = ''

export function buildMemorySnapshot(): string {
  const mem = readFileSafe(MEMORY_FILE)
  const usr = readFileSafe(USER_FILE)
  let snap = ''
  if (usr.trim()) snap += `# About the user\n\n${usr.trim()}\n\n`
  if (mem.trim()) snap += `# Agent memory\n\n${mem.trim()}\n\n`
  return snap
}

export function refreshMemorySnapshot() {
  memorySnapshot = buildMemorySnapshot()
  return memorySnapshot
}

export function getMemorySnapshot(): string {
  if (!memorySnapshot) refreshMemorySnapshot()
  return memorySnapshot
}

function appendEntry(file: string, entry: string, maxChars = 2200) {
  const existing = readFileSafe(file)
  const stamp = new Date().toISOString().slice(0, 16)
  const block = `\n\n## ${stamp}\n\n${entry.trim().slice(0, maxChars)}\n`
  writeFileSync(file, existing + block)
}

registerTool({
  name: 'memory_save',
  description:
    'Save a durable memory entry that will persist across sessions. ' +
    'Use for facts, decisions, user preferences, project context — anything ' +
    'worth remembering next time. Be concise (one observation per call). ' +
    'The entry is timestamped and appended to MEMORY.md.',
  parameters: {
    type: 'object',
    properties: {
      entry: { type: 'string', description: 'The memory to save (concise, factual)' },
      kind: {
        type: 'string',
        enum: ['memory', 'user'],
        description: '"memory" (default) for general facts, "user" for user-specific notes',
      },
    },
    required: ['entry'],
  },
  async execute(args) {
    const entry = String(args.entry ?? '')
    const kind = String(args.kind ?? 'memory')
    if (!entry.trim()) return 'Error: empty entry'
    const file = kind === 'user' ? USER_FILE : MEMORY_FILE
    appendEntry(file, entry)
    refreshMemorySnapshot()
    return `Saved ${kind} memory (${entry.length} chars).`
  },
})

registerTool({
  name: 'memory_read',
  description: 'Read all current memory entries (MEMORY.md and USER.md).',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const mem = readFileSafe(MEMORY_FILE)
    const usr = readFileSafe(USER_FILE)
    return `--- USER.md ---\n${usr || '[empty]'}\n\n--- MEMORY.md ---\n${mem || '[empty]'}`
  },
})
