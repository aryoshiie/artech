// file_read / file_write / file_list — basic file operations scoped to working dir.
import { registerTool } from './registry.ts'
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join, resolve, relative, isAbsolute } from 'node:path'

function safePath(workdir: string, p: string): string {
  const abs = isAbsolute(p) ? p : join(workdir, p)
  const resolved = resolve(abs)
  const rel = relative(workdir, resolved)
  if (rel.startsWith('..')) {
    throw new Error(`Path escapes working directory: ${p}`)
  }
  return resolved
}

registerTool({
  name: 'file_read',
  description:
    'Read the contents of a file. Path is relative to the session working directory ' +
    'or absolute within it. Returns text content. For binary files, use shell_exec with xxd/file.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path (relative or absolute within workdir)' },
      max_bytes: { type: 'number', description: 'Max bytes to read (default 50000)' },
    },
    required: ['path'],
  },
  async execute(args, ctx) {
    const path = String(args.path ?? '')
    const maxBytes = Number(args.max_bytes ?? 50000)
    const full = safePath(ctx.workingDir, path)
    const buf = readFileSync(full)
    const truncated = buf.length > maxBytes
    const content = buf.subarray(0, maxBytes).toString('utf8')
    return content + (truncated ? `\n... [truncated, ${buf.length - maxBytes} bytes omitted]` : '')
  },
})

registerTool({
  name: 'file_write',
  description:
    'Write content to a file (overwrites). Creates parent directories if needed. ' +
    'Path is relative to the session working directory.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['path', 'content'],
  },
  async execute(args, ctx) {
    const path = String(args.path ?? '')
    const content = String(args.content ?? '')
    const full = safePath(ctx.workingDir, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
    return `Wrote ${content.length} bytes to ${path}`
  },
})

registerTool({
  name: 'file_list',
  description: 'List files and directories at a path (non-recursive).',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path (default: workdir)' },
    },
  },
  async execute(args, ctx) {
    const path = String(args.path ?? '.')
    const full = safePath(ctx.workingDir, path)
    const entries = readdirSync(full, { withFileTypes: true })
    return entries
      .map((e) => {
        const isDir = e.isDirectory()
        const name = isDir ? `${e.name}/` : e.name
        let size = ''
        try {
          if (!isDir) size = ` (${statSync(join(full, e.name)).size} bytes)`
        } catch {}
        return `${name}${size}`
      })
      .join('\n') || '[empty]'
  },
})
