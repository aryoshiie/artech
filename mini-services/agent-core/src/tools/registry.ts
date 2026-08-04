// Tool registry — self-registration pattern like Hermes ToolRegistry,
// but with a plain Map. Tools declare OpenAI-style schemas.
import type { ToolEntry, ToolContext } from '../types.ts'

const registry = new Map<string, ToolEntry>()
const loaders: Array<() => void> = []
let discovered = false

export function registerTool(entry: ToolEntry) {
  if (registry.has(entry.name)) {
    throw new Error(`Tool already registered: ${entry.name}`)
  }
  registry.set(entry.name, entry)
}

export function getTool(name: string): ToolEntry | undefined {
  return registry.get(name)
}

export function listTools(): ToolEntry[] {
  return Array.from(registry.values())
}

export function getToolDefinitions(names?: string[]) {
  const tools = names
    ? names.map((n) => registry.get(n)).filter(Boolean) as ToolEntry[]
    : listTools()
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const tool = registry.get(name)
  if (!tool) {
    return `Error: unknown tool "${name}"`
  }
  try {
    return await tool.execute(args, ctx)
  } catch (err: any) {
    return `Error executing ${name}: ${err?.message ?? String(err)}`
  }
}

// Auto-discover tools in this folder
export async function discoverTools() {
  if (discovered) return
  discovered = true
  // Import all tool modules — each registers itself via registerTool()
  // Order matters for log readability, not for correctness.
  await import('./shell.ts')
  await import('./file.ts')
  await import('./http.ts')
  await import('../memory/store.ts')
  await import('./skills.ts')
}
