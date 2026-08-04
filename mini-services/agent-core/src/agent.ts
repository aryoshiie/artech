// Agent — the heart of the system. Hermes-inspired loop:
//   1. Drain steers / interrupts
//   2. Build API messages (strip persistence, apply system prompt + memory snapshot)
//   3. Call LLM provider (transport-dispatched)
//   4. If tool_calls: execute them, append tool results, loop
//   5. If stop: finalize turn
// Budget-capped to prevent runaway loops.
import { state } from './state.ts'
import { ZaiProvider } from './providers/zai.ts'
import { getToolDefinitions, executeTool } from './tools/registry.ts'
import { getMemorySnapshot } from './memory/store.ts'
import { buildSkillsIndex } from './tools/skills.ts'
import type {
  ApiMessage, Message, Session, StreamEvent, ToolCall, ToolContext, ProviderTransport,
} from './types.ts'

const MAX_ITERATIONS = 25
const SYSTEM_PROMPT_BASE = `You are a capable personal AI agent helping with business and personal tasks.
You have tools to execute shell commands, read/write files, fetch URLs, save memories, and read skills.

Working principles:
- Be proactive: when a task needs a tool, use it. Don't just describe what you *would* do — do it.
- Be concise in prose; let tool output carry the data.
- When you learn something durable (a fact, preference, decision), save it with memory_save.
- When unsure about a domain, check installed skills with skill_read.
- Verify your work: after running a command, read the output before claiming success.
- If a command fails, read the error, fix it, retry — don't give up after one attempt.
- Stay within the session's working directory for file ops.`

/**
 * Optional runtime config override — used by /run-task endpoints so callers
 * (e.g. artech dashboard) can spin up an agent with custom system prompt,
 * tool whitelist, max iterations, and temperature WITHOUT needing the agent
 * to be registered in agent-core's own Supabase registry. This is the key
 * integration seam between artech's Prisma-backed agents and agent-core.
 */
export interface AgentConfigOverride {
  systemPrompt?: string
  toolWhitelist?: string[]
  maxIterations?: number
  temperature?: number
}

export class Agent {
  private provider: ProviderTransport
  private sessionId: string
  private workingDir: string
  private abortController: AbortController | null = null
  private configOverride: AgentConfigOverride | null

  constructor(session: Session, provider?: ProviderTransport, configOverride?: AgentConfigOverride) {
    this.sessionId = session.id
    this.workingDir = session.workingDir
    this.provider = provider ?? new ZaiProvider()
    this.configOverride = configOverride ?? null

    // If temperature override was provided, propagate it to the provider
    // (ZaiProvider reads `this.model` but we set temperature per-call below).
  }

  // Get effective max iterations (override or default)
  private get effectiveMaxIterations(): number {
    const n = this.configOverride?.maxIterations
    if (typeof n === 'number' && n > 0 && n <= 100) return n
    return MAX_ITERATIONS
  }

  // Get effective system prompt (override or default)
  private get effectiveSystemPrompt(): string {
    return this.configOverride?.systemPrompt?.trim() || SYSTEM_PROMPT_BASE
  }

  // Run one user turn. Emits stream events to `onEvent`. Resolves when turn ends.
  async runTurn(
    userMessage: string,
    onEvent: (e: StreamEvent) => void
  ): Promise<void> {
    this.abortController = new AbortController()
    const { signal } = this.abortController

    // Persist user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      role: 'user',
      content: userMessage,
      createdAt: Date.now(),
    }
    state.addMessage(userMsg)

    // Auto-title the session from first user message
    const session = state.getSession(this.sessionId)
    if (session && (session.title === 'New Session')) {
      const title = userMessage.slice(0, 60).replace(/\n/g, ' ').trim()
      state.updateTitle(this.sessionId, title || 'New Session')
    }

    const emit = onEvent

    try {
      for (let iter = 0; iter < this.effectiveMaxIterations; iter++) {
        if (signal.aborted) {
          emit({ type: 'error', message: 'Interrupted by user' })
          return
        }

        // Build API messages (uses effectiveSystemPrompt + optional tool whitelist)
        const apiMessages = this.buildApiMessages()

        // Get tool definitions (filtered by override whitelist if provided)
        const tools = getToolDefinitions(this.configOverride?.toolWhitelist)

        // Call provider
        let response
        try {
          response = await this.provider.complete(
            apiMessages,
            tools,
            signal,
            typeof this.configOverride?.temperature === 'number'
              ? { temperature: this.configOverride.temperature }
              : undefined,
          )
        } catch (err: any) {
          if (signal.aborted) {
            emit({ type: 'error', message: 'Interrupted by user' })
            return
          }
          emit({ type: 'error', message: `LLM error: ${err?.message ?? String(err)}` })
          return
        }

        if (response.usage) {
          emit({
            type: 'usage',
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
          })
        }

        // Stream content tokens (here we emit the full content at once;
        // for true token streaming, switch to provider.stream() later)
        if (response.content) {
          emit({ type: 'token', value: response.content })
        }

        // Persist assistant message
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          sessionId: this.sessionId,
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
          createdAt: Date.now(),
        }
        state.addMessage(assistantMsg)
        emit({ type: 'message_end', messageId: assistantMsg.id })

        // No tool calls → turn ends
        if (response.toolCalls.length === 0 || response.finishReason === 'stop') {
          emit({ type: 'turn_end' })
          return
        }

        // Execute tool calls
        for (const tc of response.toolCalls) {
          if (signal.aborted) break

          emit({ type: 'tool_call_start', name: tc.name, id: tc.id, args: tc.arguments })

          const ctx: ToolContext = {
            sessionId: this.sessionId,
            workingDir: this.workingDir,
            emit,
          }

          const result = await executeTool(tc.name, tc.arguments, ctx)

          emit({ type: 'tool_call_end', id: tc.id, result, isError: result.startsWith('Error') })

          // Persist tool result message
          state.addMessage({
            id: crypto.randomUUID(),
            sessionId: this.sessionId,
            role: 'tool',
            content: result,
            toolCallId: tc.id,
            toolName: tc.name,
            createdAt: Date.now(),
          })
        }

        // Loop continues → LLM sees tool results and decides next step
      }

      emit({ type: 'error', message: `Reached max iterations (${this.effectiveMaxIterations})` })
      emit({ type: 'turn_end' })
    } finally {
      this.abortController = null
    }
  }

  interrupt() {
    this.abortController?.abort()
  }

  private buildApiMessages(): ApiMessage[] {
    const memory = getMemorySnapshot()
    const skillsIndex = buildSkillsIndex()
    const systemPrompt = `${this.effectiveSystemPrompt}

${memory}# Installed skills

${skillsIndex}

# Environment

Working directory: ${this.workingDir}
Today: ${new Date().toISOString().slice(0, 10)}`

    const apiMessages: ApiMessage[] = [{ role: 'system', content: systemPrompt }]

    const history = state.listMessages(this.sessionId)
    // Only send last ~30 messages to protect context window
    const recent = history.slice(-30)
    for (const m of recent) {
      if (m.role === 'user') {
        apiMessages.push({ role: 'user', content: m.content })
      } else if (m.role === 'assistant') {
        const msg: ApiMessage = { role: 'assistant', content: m.content || undefined }
        if (m.toolCalls && m.toolCalls.length > 0) {
          msg.tool_calls = m.toolCalls.map((tc) => ({
            id: tc.id, type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          }))
          // OpenAI requires content to be null when tool_calls present on some providers
          if (!m.content) msg.content = undefined
        }
        apiMessages.push(msg)
      } else if (m.role === 'tool') {
        apiMessages.push({
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId,
          name: m.toolName,
        })
      }
    }
    return apiMessages
  }
}
