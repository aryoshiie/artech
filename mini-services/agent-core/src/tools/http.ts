// http_fetch — fetch a URL and return body (text). Simple, no JS rendering.
// For JS-rendered pages, extend with a browser tool later (Browserbase / Playwright).
import { registerTool } from './registry.ts'

registerTool({
  name: 'http_fetch',
  description:
    'Fetch a URL over HTTP/HTTPS and return the response body as text. ' +
    'Useful for REST APIs, RSS feeds, simple HTML pages. For dynamic JS pages, ' +
    'consider shell_exec with curl + a headless browser. Returns up to 50KB by default.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
      method: { type: 'string', description: 'HTTP method (default GET)' },
      headers: {
        type: 'object',
        description: 'Request headers as key-value pairs',
        additionalProperties: { type: 'string' },
      },
      body: { type: 'string', description: 'Request body for POST/PUT' },
      max_bytes: { type: 'number', description: 'Max response bytes (default 50000)' },
    },
    required: ['url'],
  },
  async execute(args) {
    const url = String(args.url ?? '')
    const method = String(args.method ?? 'GET').toUpperCase()
    const headers = (args.headers ?? {}) as Record<string, string>
    const body = args.body ? String(args.body) : undefined
    const maxBytes = Number(args.max_bytes ?? 50000)

    if (!url.match(/^https?:\/\//)) {
      return 'Error: URL must start with http:// or https://'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ?? undefined,
        signal: controller.signal,
      })
      const text = await res.text()
      const truncated = text.length > maxBytes
      const status = `HTTP ${res.status} ${res.statusText}`
      const ct = res.headers.get('content-type') ?? 'unknown'
      return `[${status} | ${ct}]\n${text.slice(0, maxBytes)}` +
        (truncated ? `\n... [truncated, ${text.length - maxBytes} chars omitted]` : '')
    } finally {
      clearTimeout(timer)
    }
  },
})
