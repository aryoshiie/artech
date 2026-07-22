#!/usr/bin/env bash
# scripts/switch-to-production.sh — Ubah project dari SQLite (demo) ke PostgreSQL Supabase (production)
# Jalankan: bash scripts/switch-to-production.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔄 Switching Artech to PRODUCTION mode (PostgreSQL Supabase)..."
echo ""

# ===== 1. Backup current SQLite schema =====
echo "📦 Step 1/4: Backup SQLite schema..."
cp prisma/schema.prisma prisma/schema.sqlite.backup.prisma
echo "   ✓ Backup saved: prisma/schema.sqlite.backup.prisma"
echo ""

# ===== 2. Write production schema (PostgreSQL + multiSchema) =====
echo "📦 Step 2/4: Write production schema (PostgreSQL + multiSchema)..."

cat > prisma/schema.prisma << 'PRISMA_EOF'
// Artech Orchestrator — Prisma schema (PRODUCTION: PostgreSQL Supabase)
// Original: SQLite (sandbox demo) — restored to PostgreSQL for Vercel deploy

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  schemas   = ["artech"]
}

// =============== ENUMS ===============

enum MessageRole {
  user
  agent
  system

  @@schema("artech")
}

enum SessionMode {
  default
  bypass

  @@schema("artech")
}

enum SessionStatus {
  active
  ended_agent
  ended_user
  ended_idle
  ended_error

  @@schema("artech")
}

enum ExecutionStatus {
  pending
  running
  success
  error
  timeout

  @@schema("artech")
}

// =============== MODELS ===============

model Agent {
  id              String    @id
  name            String
  role            String
  desc            String    @default("")
  color           String
  glow            String    @default("")
  size            Float     @default(4)
  orbit           Float     @default(30)
  duration        Float     @default(20)
  ring            Boolean   @default(false)
  isCore          Boolean   @default(false)
  custom          Boolean   @default(false)

  routingKeywords String?

  orchestratorOrder Int     @default(0)

  voicePitch       Float    @default(1)
  voiceRate        Float    @default(1)
  voiceGender      String?
  voiceName        String?

  webhookUrl       String?
  workflowId       String?

  xp               Int      @default(0)
  level            Int      @default(1)

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  messages         Message[]
  tools            Tool[]
  sessions         Session[]        @relation("SessionActiveAgent")
  executions       AgentExecution[]

  @@index([isCore])
  @@index([orchestratorOrder])
  @@schema("artech")
}

model Tool {
  id        String   @id @default(cuid())
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
  name      String
  desc      String   @default("")
  icon      String?
  color     String
  size      Float    @default(1)
  orbit     Float    @default(6)
  duration  Float    @default(6)
  callCount Int      @default(0)
  createdAt DateTime @default(now())

  @@index([agentId])
  @@schema("artech")
}

model Message {
  id        String      @id @default(cuid())
  agentId   String
  agent     Agent       @relation(fields: [agentId], references: [id], onDelete: Cascade)
  sessionId String?
  session   Session?    @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  role      MessageRole
  text      String?
  files     Json?
  createdAt DateTime    @default(now())

  @@index([agentId, createdAt])
  @@index([sessionId])
  @@schema("artech")
}

model Session {
  id              String        @id @default(cuid())
  mode            SessionMode   @default(default)
  status          SessionStatus @default(active)
  activeAgentId   String?
  activeAgent     Agent?        @relation("SessionActiveAgent", fields: [activeAgentId], references: [id], onDelete: SetNull)

  lastActivityAt  DateTime      @default(now())
  startedAt       DateTime      @default(now())
  endedAt         DateTime?

  userAgent       String?
  ipAddress       String?

  messages        Message[]
  executions      AgentExecution[]

  @@index([status])
  @@index([activeAgentId])
  @@schema("artech")
}

model AgentExecution {
  id          String           @id @default(cuid())
  agentId     String
  agent       Agent            @relation(fields: [agentId], references: [id], onDelete: Cascade)
  sessionId   String?
  session     Session?         @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  workflowId  String?

  status      ExecutionStatus  @default(pending)
  input       Json?
  output      Json?
  error       String?

  startedAt   DateTime         @default(now())
  finishedAt  DateTime?
  durationMs  Int?

  @@index([agentId, startedAt])
  @@index([sessionId])
  @@index([status])
  @@schema("artech")
}

model Settings {
  id                    String   @id @default("singleton")
  webhookUrl            String?
  orchestratorAgentId   String?
  autonomousMode        Boolean  @default(false)
  autonomousIntervalMin Int      @default(10)
  voiceEnabled          Boolean  @default(true)
  n8nBaseUrl            String?
  n8nApiKey             String?
  sessionIdleTimeoutMin Int      @default(30)
  ownerNotifyWebhook    String?
  updatedAt             DateTime @updatedAt

  @@schema("artech")
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  passkeys     Passkey[]
  sessions     AuthSession[]
  accessLogs   AccessLog[]

  @@schema("artech")
}

model Passkey {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  publicKey       String
  counter         Int      @default(0)
  deviceType      String?
  transports      String?
  name            String?
  createdAt       DateTime @default(now())
  lastUsedAt      DateTime?

  @@index([userId])
  @@schema("artech")
}

model AuthSession {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token       String   @unique
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  ipAddress   String?
  userAgent   String?

  @@index([userId])
  @@index([expiresAt])
  @@schema("artech")
}

model AccessLog {
  id          String   @id @default(cuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  event       String
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([event, createdAt])
  @@schema("artech")
}
PRISMA_EOF

echo "   ✓ Production schema written: prisma/schema.prisma"
echo ""

# ===== 3. Restore Supabase storage (replacing local filesystem) =====
echo "📦 Step 3/4: Restore Supabase Storage adapter..."

cat > src/lib/supabase-storage.ts << 'TS_EOF'
// src/lib/supabase-storage.ts — Supabase Storage adapter (PRODUCTION)
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY env vars required");
    }
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}

const BUCKET = "artech-uploads";

export async function uploadFile(
  buffer: Buffer,
  relativePath: string
): Promise<{ url: string; path: string }> {
  const supabase = getClient();
  // Sanitize path — keep subdir structure but clean filename
  const safePath = relativePath
    .split("/")
    .map((s) => s.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .join("/");
  const uniquePath = `${Date.now()}-${safePath}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(uniquePath, buffer, { upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(uniquePath);

  return { url: urlData.publicUrl, path: uniquePath };
}

export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const supabase = getClient();
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    return !error;
  } catch {
    return false;
  }
}
TS_EOF

echo "   ✓ Supabase storage adapter restored: src/lib/supabase-storage.ts"
echo ""

# ===== 4. Update chat route: String → Json (production) =====
echo "📦 Step 4/4: Update chat route for Json fields (PostgreSQL)..."

# Cek apakah chat route masih pakai JSON.stringify (mode SQLite)
if grep -q "JSON.stringify" src/app/api/chat/route.ts; then
  # Backup dulu
  cp src/app/api/chat/route.ts src/app/api/chat/route.sqlite.backup.ts

  # Revert JSON.stringify → object langsung (PostgreSQL mendukung Json)
  sed -i 's|files: savedFilesMeta ? JSON.stringify(savedFilesMeta) : null,|files: savedFilesMeta ? (savedFilesMeta as any) : undefined,|g' src/app/api/chat/route.ts
  sed -i 's|input: JSON.stringify({|input: {|g' src/app/api/chat/route.ts
  sed -i 's|output: JSON.stringify({ reply: replyText, endSession }),|output: { reply: replyText, endSession } as any,|g' src/app/api/chat/route.ts
  sed -i 's|output: JSON.stringify(n8nRes),|output: n8nRes as any,|g' src/app/api/chat/route.ts

  echo "   ✓ Chat route reverted to Json fields (PostgreSQL)"
  echo "   ✓ Backup saved: src/app/api/chat/route.sqlite.backup.ts"
else
  echo "   ℹ Chat route already using Json fields — no changes needed"
fi
echo ""

# ===== Create .env.production.example =====
echo "📦 Bonus: Create .env.production.example..."

cat > .env.production.example << 'ENV_EOF'
# ===== ARTECH PRODUCTION ENV VARS (set these in Vercel) =====

# Database (Supabase PostgreSQL — connection pooling untuk serverless)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Database direct connection (untuk prisma migrate)
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].supabase.com:5432/postgres"

# Supabase Storage (untuk file upload)
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_xxxxx"
NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"

# App config
NEXT_PUBLIC_APP_NAME="ARTECH"

# n8n (opsional — kalau pakai n8n webhook per agent)
N8N_BASE_URL="https://your-n8n.com"
ENV_EOF

echo "   ✓ Created: .env.production.example"
echo ""

# ===== Summary =====
echo "================================================"
echo "✅ DONE — Project switched to PRODUCTION mode!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Isi .env.production.example dengan credentials Supabase Anda"
echo "  2. Salin ke .env.local: cp .env.production.example .env.local"
echo "  3. Test lokal: bun run dev"
echo "  4. Push DB: npx prisma db push && npx tsx prisma/seed.ts"
echo "  5. Commit: git add -A && git commit -m 'feat: production mode'"
echo "  6. Push ke GitHub: git push"
echo "  7. Deploy ke Vercel: vercel --prod"
echo "  8. Set env vars di Vercel dashboard (atau: vercel env add)"
echo ""
echo "Rollback ke SQLite demo mode:"
echo "  cp prisma/schema.sqlite.backup.prisma prisma/schema.prisma"
echo "  (restore src/lib/supabase-storage.ts manual)"
echo ""
echo "📖 Panduan lengkap: public/DEPLOY-GITHUB-VERCEL.md"
