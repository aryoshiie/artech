-- =====================================================
-- ARTECH DATABASE SETUP (untuk Chromebook / tanpa install)
-- Cara pakai:
-- 1. Buka https://supabase.com/dashboard/project/bhkntsmylvngaawjzvnq/sql/new
-- 2. Copy semua SQL ini, paste ke editor
-- 3. Klik Run (tombol hijau di kanan bawah)
-- 4. Tunggu sampai muncul "Success. No rows returned"
-- 5. Database siap dipakai!
-- =====================================================

-- 1. Buat schema "artech" (terpisah dari data lama di schema public)
CREATE SCHEMA IF NOT EXISTS artech;

-- 2. Buat enum types
CREATE TYPE artech."MessageRole" AS ENUM ('user', 'agent', 'system');
CREATE TYPE artech."SessionMode" AS ENUM ('default', 'bypass');
CREATE TYPE artech."SessionStatus" AS ENUM ('active', 'ended_agent', 'ended_user', 'ended_idle', 'ended_error');
CREATE TYPE artech."ExecutionStatus" AS ENUM ('pending', 'running', 'success', 'error', 'timeout');

-- 3. Buat tabel: Agent (bintang/planet)
CREATE TABLE IF NOT EXISTS artech."Agent" (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    "desc" TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL,
    glow TEXT NOT NULL DEFAULT '',
    size DOUBLE PRECISION NOT NULL DEFAULT 4,
    orbit DOUBLE PRECISION NOT NULL DEFAULT 30,
    duration DOUBLE PRECISION NOT NULL DEFAULT 20,
    ring BOOLEAN NOT NULL DEFAULT false,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    custom BOOLEAN NOT NULL DEFAULT false,
    "routingKeywords" TEXT,
    "orchestratorOrder" INTEGER NOT NULL DEFAULT 0,
    "voicePitch" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "voiceRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "voiceGender" TEXT,
    "voiceName" TEXT,
    "webhookUrl" TEXT,
    "workflowId" TEXT,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Buat tabel: Session (percakapan)
CREATE TABLE IF NOT EXISTS artech."Session" (
    id TEXT PRIMARY KEY NOT NULL,
    mode artech."SessionMode" NOT NULL DEFAULT 'default',
    status artech."SessionStatus" NOT NULL DEFAULT 'active',
    "activeAgentId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    CONSTRAINT "Session_activeAgentId_fkey" FOREIGN KEY ("activeAgentId") REFERENCES artech."Agent"(id) ON DELETE SET NULL
);

-- 5. Buat tabel: Tool (sub-planet)
CREATE TABLE IF NOT EXISTS artech."Tool" (
    id TEXT PRIMARY KEY NOT NULL,
    "agentId" TEXT NOT NULL,
    name TEXT NOT NULL,
    "desc" TEXT NOT NULL DEFAULT '',
    icon TEXT,
    color TEXT NOT NULL,
    size DOUBLE PRECISION NOT NULL DEFAULT 1,
    orbit DOUBLE PRECISION NOT NULL DEFAULT 6,
    duration DOUBLE PRECISION NOT NULL DEFAULT 6,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tool_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES artech."Agent"(id) ON DELETE CASCADE
);

-- 6. Buat tabel: Message (percakapan)
CREATE TABLE IF NOT EXISTS artech."Message" (
    id TEXT PRIMARY KEY NOT NULL,
    "agentId" TEXT NOT NULL,
    "sessionId" TEXT,
    role artech."MessageRole" NOT NULL,
    text TEXT,
    files JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES artech."Agent"(id) ON DELETE CASCADE,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES artech."Session"(id) ON DELETE SET NULL
);

-- 7. Buat tabel: AgentExecution (log eksekusi)
CREATE TABLE IF NOT EXISTS artech."AgentExecution" (
    id TEXT PRIMARY KEY NOT NULL,
    "agentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "workflowId" TEXT,
    status artech."ExecutionStatus" NOT NULL DEFAULT 'pending',
    input JSONB,
    output JSONB,
    error TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    CONSTRAINT "AgentExecution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES artech."Agent"(id) ON DELETE CASCADE,
    CONSTRAINT "AgentExecution_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES artech."Session"(id) ON DELETE SET NULL
);

-- 8. Buat tabel: Settings (konfigurasi global)
CREATE TABLE IF NOT EXISTS artech."Settings" (
    id TEXT PRIMARY KEY NOT NULL DEFAULT 'singleton',
    "webhookUrl" TEXT,
    "orchestratorAgentId" TEXT,
    "autonomousMode" BOOLEAN NOT NULL DEFAULT false,
    "autonomousIntervalMin" INTEGER NOT NULL DEFAULT 10,
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "n8nBaseUrl" TEXT,
    "n8nApiKey" TEXT,
    "sessionIdleTimeoutMin" INTEGER NOT NULL DEFAULT 30,
    "ownerNotifyWebhook" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Buat tabel: User (login owner)
CREATE TABLE IF NOT EXISTS artech."User" (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Buat tabel: Passkey (WebAuthn)
CREATE TABLE IF NOT EXISTS artech."Passkey" (
    id TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    "deviceType" TEXT,
    transports TEXT,
    name TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES artech."User"(id) ON DELETE CASCADE
);

-- 11. Buat tabel: AuthSession (session login)
CREATE TABLE IF NOT EXISTS artech."AuthSession" (
    id TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES artech."User"(id) ON DELETE CASCADE
);

-- 12. Buat tabel: AccessLog (log akses)
CREATE TABLE IF NOT EXISTS artech."AccessLog" (
    id TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT,
    event TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    metadata JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES artech."User"(id) ON DELETE SET NULL
);

-- 13. Buat indexes
CREATE INDEX IF NOT EXISTS "Agent_isCore_idx" ON artech."Agent"("isCore");
CREATE INDEX IF NOT EXISTS "Agent_orchestratorOrder_idx" ON artech."Agent"("orchestratorOrder");
CREATE INDEX IF NOT EXISTS "Tool_agentId_idx" ON artech."Tool"("agentId");
CREATE INDEX IF NOT EXISTS "Message_agentId_createdAt_idx" ON artech."Message"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_sessionId_idx" ON artech."Message"("sessionId");
CREATE INDEX IF NOT EXISTS "Session_status_idx" ON artech."Session"(status);
CREATE INDEX IF NOT EXISTS "Session_activeAgentId_idx" ON artech."Session"("activeAgentId");
CREATE INDEX IF NOT EXISTS "AgentExecution_agentId_startedAt_idx" ON artech."AgentExecution"("agentId", "startedAt");
CREATE INDEX IF NOT EXISTS "AgentExecution_sessionId_idx" ON artech."AgentExecution"("sessionId");
CREATE INDEX IF NOT EXISTS "AgentExecution_status_idx" ON artech."AgentExecution"(status);
CREATE INDEX IF NOT EXISTS "Passkey_userId_idx" ON artech."Passkey"("userId");
CREATE INDEX IF NOT EXISTS "AuthSession_userId_idx" ON artech."AuthSession"("userId");
CREATE INDEX IF NOT EXISTS "AuthSession_expiresAt_idx" ON artech."AuthSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "AccessLog_userId_createdAt_idx" ON artech."AccessLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AccessLog_event_createdAt_idx" ON artech."AccessLog"(event, "createdAt");

-- 14. Seed: Inti Galaksi (orchestrator)
INSERT INTO artech."Agent" (id, name, role, "desc", color, glow, size, orbit, duration, ring, "isCore", "routingKeywords", "orchestratorOrder", "voicePitch", "voiceRate", "voiceGender")
VALUES ('orchestrator', 'Inti Galaksi', 'Master Orchestrator', 'Bintang terbesar di jantung Bimasakti. Pusat komando galaksi — menerima instruksi umum, menentukan agent mana yang mengeksekusi, dan merangkum hasil akhir.', '#ffd96b', '#fff8d6', 7.0, 0, 0, false, true, 'inti,galaksi,core,matahari,orchestrator,sun,pusat,arth,artha', 0, 0.9, 0.97, 'male')
ON CONFLICT (id) DO NOTHING;

-- 15. Seed: 8 planet agents
INSERT INTO artech."Agent" (id, name, role, "desc", color, glow, size, orbit, duration, ring, "isCore", "routingKeywords", "orchestratorOrder", "voicePitch", "voiceRate", "voiceGender")
VALUES
('mercury', 'Merkurius', 'Respons Cepat', 'Menjawab pertanyaan singkat dan tugas ringan secara instan, tanpa basa-basi.', '#ad9c8e', '#e8d9c8', 3.8, 15, 9, false, false, 'mercury,merkurius,merkur,merk', 1, 1.25, 1.15, 'female'),
('venus', 'Venus', 'Konten & Komunikasi', 'Menulis, menyunting, dan merapikan naskah, pesan, maupun materi komunikasi.', '#e8c99b', '#fff0cf', 4.6, 20, 14, false, false, 'venus', 2, 1.1, 1.0, 'female'),
('earth', 'Bumi', 'Riset & Data', 'Mengumpulkan, meriset, dan merangkum data maupun informasi dari berbagai sumber.', '#3f7fd1', '#8fd3c4', 5.0, 25, 19, false, false, 'bumi,earth', 3, 1.0, 1.0, 'neutral'),
('mars', 'Mars', 'Automasi & Eksekusi', 'Menjalankan dan memicu workflow n8n — agent yang benar-benar mengeksekusi tugas otomatis.', '#c1440e', '#ff9466', 4.2, 30, 24, false, false, 'mars', 4, 0.9, 1.05, 'male'),
('jupiter', 'Yupiter', 'Reasoning Mendalam', 'Menganalisis masalah kompleks, menimbang opsi, dan mengambil keputusan strategis.', '#d9a066', '#ffdca6', 7.6, 37, 33, false, false, 'yupiter,jupiter,yupit', 5, 0.78, 0.92, 'male'),
('saturn', 'Saturnus', 'Perencanaan & Jadwal', 'Mengatur prioritas, tenggat, dan rencana jangka panjang lintas agent.', '#e3c88f', '#fff2cf', 6.6, 44, 41, true, false, 'saturnus,saturn', 6, 0.95, 0.9, 'male'),
('uranus', 'Uranus', 'Pengembangan & Kode', 'Menulis, meninjau, dan memperbaiki kode maupun konfigurasi teknis.', '#9fe0e0', '#dcfbfb', 5.6, 50, 48, false, false, 'uranus', 7, 1.05, 1.0, 'neutral'),
('neptune', 'Neptunus', 'Monitoring & QA', 'Mengawasi kualitas hasil kerja seluruh agent dan menandai anomali.', '#3f5efb', '#a9b8ff', 5.4, 56, 55, false, false, 'neptunus,neptune,neptun', 8, 0.9, 0.95, 'male')
ON CONFLICT (id) DO NOTHING;

-- 16. Seed: 17 tools
INSERT INTO artech."Tool" (id, "agentId", name, "desc", color, size, orbit, duration)
VALUES
('tool-mercury-1', 'mercury', 'Jawaban Instan', 'Menjawab pertanyaan singkat tanpa perlu reasoning panjang.', '#c4b4a4', 0.9, 4.5, 4),
('tool-mercury-2', 'mercury', 'Kalkulator Cepat', 'Hitungan dan konversi sederhana secara langsung.', '#9a8a7a', 0.7, 6.5, 6),
('tool-venus-1', 'venus', 'Penulis Naskah', 'Menyusun draf tulisan, pesan, dan materi komunikasi dari nol.', '#f5dab5', 1.0, 5, 5),
('tool-venus-2', 'venus', 'Editor & Proofread', 'Merapikan tata bahasa, nada, dan struktur naskah yang sudah ada.', '#d4b58a', 0.8, 7, 7),
('tool-earth-1', 'earth', 'Pencarian Web', 'Mencari informasi terkini dari internet.', '#5a9fdb', 1.0, 5.5, 5),
('tool-earth-2', 'earth', 'Perangkum Dokumen', 'Membaca dan meringkas dokumen/berkas panjang.', '#6dd9b8', 0.8, 7.5, 8),
('tool-mars-1', 'mars', 'Trigger Workflow', 'Memicu workflow n8n untuk mengeksekusi tugas otomatis.', '#e06535', 0.9, 5, 4),
('tool-mars-2', 'mars', 'Penjadwal Tugas', 'Menjadwalkan eksekusi tugas berulang atau tertunda.', '#a83810', 0.7, 6.5, 6),
('tool-jupiter-1', 'jupiter', 'Analisis Multi-Opsi', 'Membandingkan beberapa opsi/skenario sebelum memutuskan.', '#e8b87a', 1.2, 6.5, 5),
('tool-jupiter-2', 'jupiter', 'Pengambil Keputusan', 'Menyintesis analisis menjadi rekomendasi final.', '#c49050', 1.0, 8.5, 7),
('tool-jupiter-3', 'jupiter', 'Pemecah Masalah', 'Menguraikan masalah kompleks jadi langkah-langkah kecil.', '#d4a066', 0.8, 10.5, 9),
('tool-saturn-1', 'saturn', 'Penyusun Jadwal', 'Menyusun rencana dan urutan prioritas kerja.', '#f0d5a0', 1.1, 6, 6),
('tool-saturn-2', 'saturn', 'Pelacak Tenggat', 'Memantau deadline dan mengingatkan tugas yang mendekat.', '#c4a870', 0.9, 8, 8),
('tool-uranus-1', 'uranus', 'Penulis Kode', 'Menulis fungsi, komponen, atau skrip baru.', '#b0e8e8', 1.0, 5.5, 5),
('tool-uranus-2', 'uranus', 'Code Reviewer', 'Meninjau dan memperbaiki kode yang sudah ada.', '#80c8c8', 0.8, 7.5, 7),
('tool-neptune-1', 'neptune', 'Pemantau Kualitas', 'Mengecek hasil kerja agent lain terhadap standar kualitas.', '#6080fb', 1.0, 5.5, 6),
('tool-neptune-2', 'neptune', 'Pendeteksi Anomali', 'Menandai hasil yang janggal atau di luar pola normal.', '#5070db', 0.8, 7.5, 8)
ON CONFLICT (id) DO NOTHING;

-- 17. Seed: Settings singleton
INSERT INTO artech."Settings" (id, "n8nBaseUrl", "orchestratorAgentId", "voiceEnabled", "sessionIdleTimeoutMin", "webhookUrl")
VALUES ('singleton', 'https://artha.loophole.site', 'orchestrator', true, 30, 'https://artha.loophole.site/webhook/orchestrator')
ON CONFLICT (id) DO UPDATE SET
    "n8nBaseUrl" = EXCLUDED."n8nBaseUrl",
    "orchestratorAgentId" = EXCLUDED."orchestratorAgentId",
    "voiceEnabled" = EXCLUDED."voiceEnabled",
    "sessionIdleTimeoutMin" = EXCLUDED."sessionIdleTimeoutMin",
    "webhookUrl" = EXCLUDED."webhookUrl";

-- =====================================================
-- SELESAI! Database siap dipakai.
-- Sekarang buka URL Vercel Anda (mis. https://artech.vercel.app)
-- → akan redirect ke /setup → buat owner account → login → galaxy muncul!
-- =====================================================
