// Skills loader — agentskills.io-compatible SKILL.md format.
// Each skill = a folder with SKILL.md (YAML frontmatter + markdown body).
// Skills live in data/skills/<name>/SKILL.md.
// The agent discovers them and can read the body on demand.
import { registerTool } from './registry.ts'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SKILLS_DIR = join(import.meta.dir, '..', '..', 'data', 'skills')

export interface Skill {
  name: string
  description: string
  version?: string
  body: string
  path: string
}

function parseFrontmatter(raw: string): { meta: Record<string, any>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }
  const meta: Record<string, any> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (m) {
      let v: any = m[2].trim()
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      meta[m[1]] = v
    }
  }
  return { meta, body: match[2].trim() }
}

export function listInstalledSkills(): Skill[] {
  if (!existsSync(SKILLS_DIR)) return []
  const skills: Skill[] = []
  for (const name of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!name.isDirectory()) continue
    const skillPath = join(SKILLS_DIR, name.name, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    try {
      const raw = readFileSync(skillPath, 'utf8')
      const { meta, body } = parseFrontmatter(raw)
      skills.push({
        name: meta.name ?? name.name,
        description: meta.description ?? '',
        version: meta.version,
        body,
        path: skillPath,
      })
    } catch {}
  }
  return skills
}

export function buildSkillsIndex(): string {
  const skills = listInstalledSkills()
  if (skills.length === 0) {
    return 'No skills installed. Use /skills to install or create one.'
  }
  return skills
    .map((s, i) => {
      const desc = s.description.length > 100
        ? s.description.slice(0, 97) + '...'
        : s.description
      return `${i + 1}. **${s.name}** — ${desc}`
    })
    .join('\n')
}

registerTool({
  name: 'skill_read',
  description:
    'Read the full body of an installed skill by name. Use this when you need ' +
    'the detailed instructions / playbook a skill provides.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Skill name (case-insensitive)' },
    },
    required: ['name'],
  },
  async execute(args) {
    const name = String(args.name ?? '').toLowerCase().trim()
    const skills = listInstalledSkills()
    const skill = skills.find((s) => s.name.toLowerCase() === name)
    if (!skill) return `Error: skill "${name}" not found. Installed: ${skills.map((s) => s.name).join(', ') || 'none'}`
    return skill.body
  },
})
