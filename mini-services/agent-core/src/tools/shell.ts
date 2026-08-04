// shell_exec — run a shell command in the session working directory.
// Dangerous-pattern approval gate (Hermes-inspired) — for personal use we
// auto-approve but log; for production add an approval callback.
import { registerTool } from './registry.ts'
import { $ } from 'bun'

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+\/(?!tmp)/,
  /\bmkfs\b/,
  /\bdd\s+if=.*of=\/dev\//,
  /\b:\(\)\s*\{.*\};:/, // fork bomb
  /\bshutdown\b/,
  /\breboot\b/,
]

function isDangerous(cmd: string): string | null {
  for (const p of DANGEROUS_PATTERNS) {
    if (p.test(cmd)) return p.source
  }
  return null
}

registerTool({
  name: 'shell_exec',
  description:
    'Execute a shell command in the session working directory. Returns stdout + stderr. ' +
    'Use this for file operations, git, build commands, running scripts, system queries. ' +
    'Avoid interactive commands (vim, top). For long-running processes, redirect output to a file.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      timeout_ms: {
        type: 'number',
        description: 'Max execution time in milliseconds (default 30000, max 120000)',
      },
    },
    required: ['command'],
  },
  async execute(args, ctx) {
    const cmd = String(args.command ?? '')
    const timeoutMs = Math.min(Number(args.timeout_ms ?? 30000), 120000)

    if (!cmd.trim()) return 'Error: empty command'

    const danger = isDangerous(cmd)
    if (danger) {
      return `Blocked: command matched dangerous pattern (${danger}). ` +
        `If this is intentional, modify the command and try again.`
    }

    ctx.emit({ type: 'tool_call_start', name: 'shell_exec', id: '', args: { command: cmd } })

    try {
      const proc = Bun.spawn(['bash', '-c', cmd], {
        cwd: ctx.workingDir,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, TERM: 'dumb' },
      })

      const timer = setTimeout(() => proc.kill('SIGTERM'), timeoutMs)
      const exitCode = await proc.exited
      clearTimeout(timer)

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()

      let out = ''
      if (stdout) out += stdout
      if (stderr) out += (out ? '\n--- stderr ---\n' : '') + stderr
      out += `\n[exit code: ${exitCode}]`

      // Truncate huge outputs to protect LLM context
      const MAX = 20000
      if (out.length > MAX) {
        out = out.slice(0, MAX) + `\n... [truncated, ${out.length - MAX} chars omitted]`
      }
      return out || '[no output]'
    } catch (err: any) {
      return `Error: ${err?.message ?? String(err)}`
    }
  },
})
