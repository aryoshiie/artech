// ZAI Provider — uses z-ai-web-dev-sdk (OpenAI-compatible).
// This is the default provider in this sandbox. For production, swap in
// OpenAIProvider or AnthropicProvider with your own API key.
import ZAI from 'z-ai-web-dev-sdk'
import type { ApiMessage, NormalizedResponse, ProviderTransport, ToolDefinition } from '../types.ts'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getClient() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export class ZaiProvider implements ProviderTransport {
  name = 'zai'
  model = 'glm-4.6'

  async complete(
    messages: ApiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
    options?: { temperature?: number }
  ): Promise<NormalizedResponse> {
    const client = await getClient()

    // z-ai-web-dev-sdk follows OpenAI chat completions shape.
    const completion = await client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      tools: tools.length > 0 ? tools as any : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      thinking: { type: 'disabled' },
      ...(typeof options?.temperature === 'number' ? { temperature: options.temperature } : {}),
    }, { signal })

    const choice = completion.choices?.[0]
    if (!choice) {
      return { content: '', toolCalls: [], finishReason: 'stop' }
    }

    const msg: any = choice.message
    const toolCalls = (msg.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParse(tc.function.arguments),
    }))

    return {
      content: msg.content ?? '',
      toolCalls,
      finishReason: choice.finish_reason ?? (toolCalls.length > 0 ? 'tool_calls' : 'stop'),
      usage: completion.usage
        ? {
            promptTokens: (completion.usage as any).prompt_tokens,
            completionTokens: (completion.usage as any).completion_tokens,
            totalTokens: (completion.usage as any).total_tokens,
          }
        : undefined,
    }
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
