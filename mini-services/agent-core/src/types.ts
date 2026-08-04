// Core types for the agent — inspired by Hermes transport abstraction,
// but stripped to the essentials for a personal business agent.

export type Role = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  id: string
  sessionId: string
  role: Role
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string
  toolName?: string
  createdAt: number
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  name: string
  content: string
  isError?: boolean
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolEntry {
  name: string
  description: string
  parameters: Record<string, unknown>
  // executor returns string content (LLM-readable). Throw on error.
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>
}

export interface ToolContext {
  sessionId: string
  workingDir: string
  // allow tools to emit progress events to the stream
  emit: (event: StreamEvent) => void
}

export interface NormalizedResponse {
  content: string
  toolCalls: ToolCall[]
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface ProviderTransport {
  name: string
  complete: (
    messages: ApiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
    options?: { temperature?: number }
  ) => Promise<NormalizedResponse>
}

// Message shape sent to LLM API (OpenAI-compatible)
export interface ApiMessage {
  role: Role
  content?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

// Server-Sent Events emitted during a turn
export type StreamEvent =
  | { type: 'token'; value: string }
  | { type: 'thinking'; value: string }
  | { type: 'tool_call_start'; name: string; id: string; args: Record<string, unknown> }
  | { type: 'tool_call_end'; id: string; result: string; isError?: boolean }
  | { type: 'message_end'; messageId: string }
  | { type: 'turn_end' }
  | { type: 'error'; message: string }
  | { type: 'usage'; promptTokens?: number; completionTokens?: number }

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  workingDir: string
  model: string
  provider: string
}
