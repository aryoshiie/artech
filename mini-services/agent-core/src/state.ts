// SQLite-backed state persistence. Inspired by Hermes SessionDB but minimal.
// Uses bun:sqlite (built-in, zero-dep). WAL mode + FTS5 for session search.
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Message, Session } from './types.ts'

const DATA_DIR = join(import.meta.dir, '..', 'data')
const DB_PATH = join(DATA_DIR, 'agent.db')

mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA synchronous = NORMAL')
db.exec('PRAGMA foreign_keys = ON')

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Session',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    working_dir TEXT NOT NULL DEFAULT '${process.cwd()}',
    model TEXT NOT NULL DEFAULT 'glm-4.6',
    provider TEXT NOT NULL DEFAULT 'zai'
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tool_calls TEXT,
    tool_call_id TEXT,
    tool_name TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,
    role UNINDEXED,
    session_id UNINDEXED,
    tokenize = 'unicode61'
  );
`)

// Prepared statements
const stmtCreateSession = db.prepare(
  `INSERT INTO sessions (id, title, created_at, updated_at, working_dir, model, provider)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
)
const stmtGetSession = db.prepare(`SELECT * FROM sessions WHERE id = ?`)
const stmtListSessions = db.prepare(
  `SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?`
)
const stmtCountSessions = db.prepare(`SELECT COUNT(*) as count FROM sessions`)
const stmtUpdateSessionTitle = db.prepare(
  `UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`
)
const stmtTouchSession = db.prepare(
  `UPDATE sessions SET updated_at = ? WHERE id = ?`
)
const stmtDeleteSession = db.prepare(`DELETE FROM sessions WHERE id = ?`)

const stmtInsertMessage = db.prepare(
  `INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id, tool_name, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
)
const stmtInsertFts = db.prepare(
  `INSERT INTO messages_fts (content, role, session_id) VALUES (?, ?, ?)`
)
const stmtListMessages = db.prepare(
  `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`
)
const stmtDeleteMessages = db.prepare(`DELETE FROM messages WHERE session_id = ?`)

const stmtSearch = db.prepare(
  `SELECT m.id, m.session_id, m.role, m.content, m.created_at
   FROM messages_fts f
   JOIN messages m ON m.id = f.rowid
   WHERE messages_fts MATCH ? AND m.role != 'tool'
   ORDER BY m.created_at DESC LIMIT ?`
)

function rowToSession(row: any): Session {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workingDir: row.working_dir,
    model: row.model,
    provider: row.provider,
  }
}

function rowToMessage(row: any): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
    toolCallId: row.tool_call_id ?? undefined,
    toolName: row.tool_name ?? undefined,
    createdAt: row.created_at,
  }
}

export const state = {
  createSession(opts: Partial<Session> = {}): Session {
    const now = Date.now()
    const id = opts.id ?? crypto.randomUUID()
    const session: Session = {
      id,
      title: opts.title ?? 'New Session',
      createdAt: now,
      updatedAt: now,
      workingDir: opts.workingDir ?? process.cwd(),
      model: opts.model ?? 'glm-4.6',
      provider: opts.provider ?? 'zai',
    }
    stmtCreateSession.run(
      session.id, session.title, session.createdAt, session.updatedAt,
      session.workingDir, session.model, session.provider
    )
    return session
  },

  getSession(id: string): Session | null {
    const row = stmtGetSession.get(id) as any
    return row ? rowToSession(row) : null
  },

  listSessions(limit = 50, offset = 0): { sessions: Session[]; total: number } {
    const rows = stmtListSessions.all(limit, offset) as any[]
    const total = (stmtCountSessions.get() as any).count
    return { sessions: rows.map(rowToSession), total }
  },

  updateTitle(id: string, title: string) {
    stmtUpdateSessionTitle.run(title, Date.now(), id)
  },

  touch(id: string) {
    stmtTouchSession.run(Date.now(), id)
  },

  deleteSession(id: string) {
    stmtDeleteSession.run(id)
  },

  addMessage(msg: Message) {
    stmtInsertMessage.run(
      msg.id, msg.sessionId, msg.role, msg.content,
      msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
      msg.toolCallId ?? null, msg.toolName ?? null, msg.createdAt
    )
    // Only index non-empty text messages (skip tool results' raw bytes)
    if (msg.content && msg.role !== 'tool') {
      stmtInsertFts.run(msg.content, msg.role, msg.sessionId)
    }
    this.touch(msg.sessionId)
  },

  listMessages(sessionId: string): Message[] {
    return (stmtListMessages.all(sessionId) as any[]).map(rowToMessage)
  },

  clearMessages(sessionId: string) {
    stmtDeleteMessages.run(sessionId)
  },

  search(query: string, limit = 20): Array<{ id: string; sessionId: string; role: string; content: string; createdAt: number }> {
    // FTS5 MATCH — escape dangerous chars, keep simple phrases
    const sanitized = query
      .replace(/["*]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t}"`)
      .join(' ')
    if (!sanitized) return []
    try {
      return (stmtSearch.all(sanitized, limit) as any[]).map((r) => ({
        id: r.id, sessionId: r.session_id, role: r.role,
        content: r.content, createdAt: r.created_at,
      }))
    } catch {
      return []
    }
  },
}
