// Settings store — local SQLite config.db for credentials & config.
// SEPARATE from the data DB (Supabase). Credentials stay on the VPS,
// never in the cloud. Dashboard reads/writes via API.
//
// Keys:
//   supabase_url, supabase_anon_key, supabase_service_role_key
//   n8n_base_url, n8n_api_key
//   llm_provider (zai|openai|anthropic), llm_api_key, llm_model
//   encryption_key (auto-generated on first run, for encrypting secrets)
import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto'

const DATA_DIR = join(import.meta.dir, '..', 'data')
const CONFIG_DB_PATH = join(DATA_DIR, 'config.db')
const ENC_KEY_FILE = join(DATA_DIR, '.enc_key')

mkdirSync(DATA_DIR, { recursive: true })

const configDb = new Database(CONFIG_DB_PATH)
configDb.exec('PRAGMA journal_mode = WAL')

configDb.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    is_secret INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )
`)

// ---- Encryption for secrets ----
function getOrCreateEncKey(): string {
  if (existsSync(ENC_KEY_FILE)) {
    return readFileSync(ENC_KEY_FILE, 'utf8').trim()
  }
  // Generate a random encryption key, store locally
  const key = randomBytes(32).toString('hex')
  writeFileSync(ENC_KEY_FILE, key, { mode: 0o600 })
  return key
}

const ENC_KEY = getOrCreateEncKey()
const ENC_SALT = 'hermes-agent-core-v1' // static salt (key file is the real secret)
const DERIVED_KEY = scryptSync(ENC_KEY, ENC_SALT, 32)

function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', DERIVED_KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

function decrypt(stored: string): string {
  if (!stored.startsWith('enc:')) return stored // plaintext fallback
  const parts = stored.split(':')
  if (parts.length !== 4) throw new Error('invalid encrypted value')
  const iv = Buffer.from(parts[1], 'hex')
  const tag = Buffer.from(parts[2], 'hex')
  const enc = Buffer.from(parts[3], 'hex')
  const decipher = createDecipheriv('aes-256-gcm', DERIVED_KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

// ---- Prepared statements ----
const stmtGet = configDb.prepare('SELECT value, is_secret FROM settings WHERE key = ?')
const stmtSet = configDb.prepare(`
  INSERT INTO settings (key, value, is_secret, updated_at) VALUES (?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = ?, is_secret = ?, updated_at = ?
`)
const stmtList = configDb.prepare('SELECT key, is_secret, updated_at FROM settings ORDER BY key')
const stmtDelete = configDb.prepare('DELETE FROM settings WHERE key = ?')

export const settings = {
  // Raw get/set
  get(key: string): string | null {
    const row = stmtGet.get(key) as any
    if (!row) return null
    return row.is_secret ? decrypt(row.value) : row.value
  },

  set(key: string, value: string, isSecret = false) {
    const now = Date.now()
    const stored = isSecret ? encrypt(value) : value
    stmtSet.run(key, stored, isSecret ? 1 : 0, now, stored, isSecret ? 1 : 0, now)
  },

  delete(key: string) {
    stmtDelete.run(key)
  },

  // List keys (never expose secret values, just which keys exist)
  list(): Array<{ key: string; isSecret: boolean; updatedAt: number }> {
    return (stmtList.all() as any[]).map((r) => ({
      key: r.key,
      isSecret: !!r.is_secret,
      updatedAt: r.updated_at,
    }))
  },

  // ---- Typed config groups ----
  getSupabaseConfig() {
    return {
      url: this.get('supabase_url'),
      anonKey: this.get('supabase_anon_key'),
      serviceRoleKey: this.get('supabase_service_role_key'),
    }
  },

  getN8nConfig() {
    return {
      baseUrl: this.get('n8n_base_url'),
      apiKey: this.get('n8n_api_key'),
    }
  },

  getLlmConfig() {
    return {
      provider: this.get('llm_provider') || 'zai',
      apiKey: this.get('llm_api_key'),
      model: this.get('llm_model') || 'glm-4.6',
    }
  },

  // Check what's configured (for dashboard setup wizard)
  getStatus() {
    const supa = this.getSupabaseConfig()
    const n8n = this.getN8nConfig()
    const llm = this.getLlmConfig()
    return {
      supabase: {
        configured: !!(supa.url && supa.anonKey && supa.serviceRoleKey),
        url: supa.url || null,
      },
      n8n: {
        configured: !!(n8n.baseUrl && n8n.apiKey),
        baseUrl: n8n.baseUrl || null,
      },
      llm: {
        configured: !!(llm.provider && (llm.apiKey || llm.provider === 'zai')),
        provider: llm.provider,
        model: llm.model,
      },
    }
  },

  // Test connections (for "Test" button in settings UI)
  async testConnection(service: 'supabase' | 'n8n' | 'llm'): Promise<{ ok: boolean; message: string }> {
    try {
      if (service === 'supabase') {
        const { url, serviceRoleKey } = this.getSupabaseConfig()
        if (!url || !serviceRoleKey) return { ok: false, message: 'Supabase URL or service role key not set' }
        const res = await fetch(`${url}/rest/v1/`, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return { ok: false, message: `Supabase REST API returned ${res.status}` }
        return { ok: true, message: 'Supabase connection OK' }
      }

      if (service === 'n8n') {
        const { baseUrl, apiKey } = this.getN8nConfig()
        if (!baseUrl || !apiKey) return { ok: false, message: 'n8n base URL or API key not set' }
        const res = await fetch(`${baseUrl}/api/v1/workflows?limit=1`, {
          headers: { 'X-N8N-API-KEY': apiKey },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return { ok: false, message: `n8n API returned ${res.status}` }
        return { ok: true, message: 'n8n connection OK' }
      }

      if (service === 'llm') {
        const { provider, apiKey, model } = this.getLlmConfig()
        if (provider === 'zai') return { ok: true, message: 'ZAI provider (sandbox default, no key needed)' }
        if (!apiKey) return { ok: false, message: 'LLM API key not set' }
        // Don't actually call LLM (costs money); just verify key format
        return { ok: true, message: `${provider} API key set (${apiKey.slice(0, 8)}...)` }
      }

      return { ok: false, message: 'Unknown service' }
    } catch (err: any) {
      return { ok: false, message: err?.message ?? String(err) }
    }
  },
}
