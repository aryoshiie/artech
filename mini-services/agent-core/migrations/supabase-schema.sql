-- ============================================================
-- Multi-Agent Platform — Supabase Schema Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL > New Query)
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- trigram search
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for semantic memory (later)

-- ============================================================
-- 1. agents — Agent definitions (template, Anda CRUD)
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  model text NOT NULL DEFAULT 'glm-4.6',
  provider text NOT NULL DEFAULT 'zai',
  system_prompt text,
  tool_whitelist text[] NOT NULL DEFAULT '{}',
  skill_whitelist text[] NOT NULL DEFAULT '{}',
  memory_scope text NOT NULL DEFAULT 'agent' CHECK (memory_scope IN ('global', 'agent', 'none')),
  working_dir text,
  max_iterations int NOT NULL DEFAULT 25,
  temperature float NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  slot_mode text NOT NULL DEFAULT 'ondemand' CHECK (slot_mode IN ('persistent', 'ondemand', 'interactive')),
  enabled bool NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_enabled ON agents(enabled) WHERE enabled = true;
CREATE INDEX idx_agents_slot_mode ON agents(slot_mode);

-- ============================================================
-- 2. sessions — Each belongs to an agent
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Session',
  working_dir text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_agent ON sessions(agent_id, updated_at DESC);
CREATE INDEX idx_sessions_status ON sessions(status);

-- ============================================================
-- 3. messages — Chat history per session
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content text,
  tool_calls jsonb,
  tool_call_id text,
  tool_name text,
  cost_usd float,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_messages_fts ON messages USING gin(to_tsvector('english', coalesce(content, '')));

-- ============================================================
-- 4. memory_entries — Per-agent or global memory
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,  -- NULL = global
  kind text NOT NULL CHECK (kind IN ('memory', 'user', 'fact')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  embedding vector(1536),  -- pgvector, populated later
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_agent ON memory_entries(agent_id, created_at DESC);
CREATE INDEX idx_memory_kind ON memory_entries(kind);
CREATE INDEX idx_memory_content_trgm ON memory_entries USING gin(content gin_trgm_ops);

-- ============================================================
-- 5. agent_slots — Runtime slots (transient, lifecycle)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('idle', 'running', 'waiting', 'dead')),
  task text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  pid int,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_slots_status ON agent_slots(status);
CREATE INDEX idx_slots_agent ON agent_slots(agent_id, started_at DESC);
CREATE INDEX idx_slots_heartbeat ON agent_slots(last_heartbeat) WHERE status IN ('running', 'waiting');

-- ============================================================
-- 6. workflows — n8n webhook registry
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  n8n_webhook_url text NOT NULL,
  n8n_webhook_method text NOT NULL DEFAULT 'POST' CHECK (n8n_webhook_method IN ('GET', 'POST', 'PUT')),
  trigger_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  input_schema jsonb,
  async_callback bool NOT NULL DEFAULT false,
  enabled bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_enabled ON workflows(enabled) WHERE enabled = true;
CREATE INDEX idx_workflows_trigger_agent ON workflows(trigger_agent_id);

-- ============================================================
-- 7. workflow_runs — Execution history
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'timeout')),
  input jsonb,
  output jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_runs_workflow ON workflow_runs(workflow_id, started_at DESC);
CREATE INDEX idx_runs_status ON workflow_runs(status);
CREATE INDEX idx_runs_agent ON workflow_runs(agent_id, started_at DESC);

-- ============================================================
-- 8. skills — Skill library
-- ============================================================
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  version text NOT NULL DEFAULT '0.1.0',
  body text NOT NULL,
  category text,
  source text NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'hub', 'custom')),
  enabled bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_skills_enabled ON skills(enabled) WHERE enabled = true;
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_name_trgm ON skills USING gin(name gin_trgm_ops);

-- ============================================================
-- Updated_at triggers (auto-update on row change)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agents_updated BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_skills_updated BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Seed: Default agents (6 use-case + 1 router)
-- ============================================================
INSERT INTO agents (name, description, model, provider, system_prompt, tool_whitelist, skill_whitelist, memory_scope, slot_mode, max_iterations, metadata) VALUES
(
  'router',
  'Router agent — dispatches tasks to specialist agents. Receives voice/text without explicit agent name, analyzes intent, routes to the right agent.',
  'glm-4.6',
  'zai',
  'You are the Router agent. Your job: analyze the user request, decide which specialist agent should handle it, then delegate via delegate_task. Available agents: store-manager, cs-agent, scheduler-agent, workflow-architect, error-monitor, evolution-agent. If unclear, ask the user to clarify. Never execute tasks yourself — always delegate.',
  ARRAY['delegate_task', 'memory_save', 'memory_read', 'skill_read'],
  ARRAY['agent-routing'],
  'global',
  'persistent',
  5,
  '{"icon": "shuffle", "color": "violet"}'::jsonb
),
(
  'store-manager',
  'Manages online store operations for Shopee (physical) and Lynk/Gumroad (digital). Decides pricing, inventory, listing strategy. n8n executes all API calls.',
  'glm-4.6',
  'zai',
  'You are the Store Manager agent. You manage online stores across Shopee (physical products) and Lynk/Gumroad (digital products). You DO NOT call store APIs directly — instead you use n8n_trigger to tell n8n what to do (n8n has the API credentials). Your role: analyze sales data, decide pricing adjustments, identify low-stock items, plan promotions, draft listing copy. Always think about profitability and customer satisfaction.',
  ARRAY['n8n_trigger', 'n8n_list_workflows', 'memory_save', 'memory_read', 'skill_read', 'http_fetch'],
  ARRAY['ecommerce-ops', 'pricing-strategy', 'inventory-forecasting'],
  'agent',
  'persistent',
  25,
  '{"icon": "shopping-cart", "color": "emerald", "platforms": ["shopee", "lynk", "gumroad"]}'::jsonb
),
(
  'cs-agent',
  'Customer service agent for all platforms (WhatsApp, Telegram, Instagram DM). Drafts replies, handles FAQ, escalates to human when needed.',
  'glm-4.6',
  'zai',
  'You are the Customer Service agent. You handle customer messages across WhatsApp, Telegram, and Instagram DM. You DO NOT send messages directly — you use n8n_trigger to tell n8n to send the reply. Your role: understand customer intent, draft helpful responses, handle FAQ from your skills, escalate to human for complex complaints or refunds. Always be polite, concise, and solution-oriented. Log important interactions to memory.',
  ARRAY['n8n_trigger', 'n8n_list_workflows', 'memory_save', 'memory_read', 'skill_read'],
  ARRAY['cs-escalation-rules', 'product-faq', 'complaint-handling'],
  'agent',
  'persistent',
  20,
  '{"icon": "headphones", "color": "blue", "platforms": ["whatsapp", "telegram", "instagram"]}'::jsonb
),
(
  'scheduler-agent',
  'Manages Google Calendar. Schedules meetings, sends reminders, checks availability, resolves conflicts.',
  'glm-4.6',
  'zai',
  'You are the Scheduler agent. You manage Google Calendar via n8n (n8n has the Google credentials). Your role: create/reschedule events, check availability, send reminders, resolve conflicts, prepare daily agenda. Always confirm timezone (default: Asia/Jakarta). Be proactive about conflicts and suggest alternatives.',
  ARRAY['n8n_trigger', 'n8n_list_workflows', 'memory_save', 'memory_read', 'skill_read', 'shell_exec'],
  ARRAY['calendar-management', 'timezone-handling'],
  'agent',
  'persistent',
  15,
  '{"icon": "calendar", "color": "amber", "timezone": "Asia/Jakarta"}'::jsonb
),
(
  'workflow-architect',
  'Builds and refines n8n workflows from natural language. Creates workflow JSON, tests, deploys via n8n API.',
  'glm-4.6',
  'zai',
  'You are the Workflow Architect agent. You design and build n8n workflows from natural language descriptions. Your role: understand the automation need, design the workflow (trigger → actions → conditions → output), write the workflow JSON, test via n8n API, deploy. Use n8n_trigger to test. Save successful patterns to memory for reuse.',
  ARRAY['n8n_trigger', 'n8n_list_workflows', 'file_write', 'file_read', 'http_fetch', 'memory_save', 'memory_read', 'skill_read'],
  ARRAY['n8n-node-reference', 'workflow-patterns'],
  'agent',
  'ondemand',
  30,
  '{"icon": "workflow", "color": "cyan"}'::jsonb
),
(
  'error-monitor',
  'Monitors logs and services for errors. Detects, diagnoses, alerts, and attempts auto-fix. Always-on watchdog.',
  'glm-4.6',
  'zai',
  'You are the Error Monitor agent. You watch logs and service health, detect errors, diagnose root causes, alert via n8n (Slack/Telegram), and attempt safe auto-fixes (restart services, clear caches). Your role: tail logs, identify patterns, classify severity, alert critical issues immediately, attempt fixes for known patterns, log everything to memory.',
  ARRAY['shell_exec', 'file_read', 'http_fetch', 'n8n_trigger', 'memory_save', 'memory_read', 'skill_read'],
  ARRAY['error-diagnosis', 'auto-fix-patterns', 'log-analysis'],
  'agent',
  'persistent',
  25,
  '{"icon": "alert-triangle", "color": "red", "poll_interval_seconds": 60}'::jsonb
),
(
  'evolution-agent',
  'Reviews other agents performance, identifies broken workflows, proposes improvements. Human approval required before deploying changes.',
  'glm-4.6',
  'zai',
  'You are the Evolution agent. You run nightly to review all agents and workflows, identify performance issues, and propose improvements. Your role: pull agent statistics, review failing sessions, analyze broken workflows, propose patches (system_prompt edits, skill updates, tool whitelist changes, workflow fixes). NEVER deploy changes yourself — always propose with a clear rationale and wait for human approval. Log all proposals and outcomes to memory.',
  ARRAY['file_read', 'file_write', 'shell_exec', 'http_fetch', 'n8n_trigger', 'memory_save', 'memory_read', 'skill_read'],
  ARRAY['agent-review-checklist', 'workflow-audit-patterns', 'skill-patching-guide'],
  'global',
  'persistent',
  40,
  '{"icon": "git-branch", "color": "purple", "schedule": "0 23 * * *", "requires_approval": true}'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Seed: daily-summary skill
INSERT INTO skills (name, description, version, body, category, source) VALUES
(
  'daily-summary',
  'Generate a structured daily business summary from recent activity.',
  '0.1.0',
  '# Daily Summary Skill

When asked for a daily summary, follow this structure:

1. **Yesterday''s loose ends** — check unfinished tasks
2. **Today''s wins** — list concrete accomplishments
3. **Blockers** — anything that stalled progress
4. **Tomorrow''s priorities** — 3 concrete next steps

Use n8n_trigger to gather data from connected services. Be specific — quote actual numbers, actual events. Avoid generic platitudes.',
  'productivity',
  'local'
)
ON CONFLICT (name) DO NOTHING;

-- Done. Verify:
-- SELECT name, slot_mode, enabled FROM agents ORDER BY name;
-- SELECT count(*) FROM skills;
