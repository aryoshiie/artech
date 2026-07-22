# ARTECH · Multi-Agent Orchestrator

## 🚀 Deploy ke Vercel

### Langkah 1: Download & Extract
Download artech-deploy.zip, extract di komputer.

### Langkah 2: Upload ke Vercel
1. Buka https://vercel.com/new
2. Drag & drop folder hasil extract (atau push ke GitHub lalu import)

### Langkah 3: Set Environment Variables (WAJIB)
Di Vercel → Settings → Environment Variables:

DATABASE_URL = postgresql://postgres.bhkntsmylvngaawjzvnq:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL = postgresql://postgres.bhkntsmylvngaawjzvnq:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
SUPABASE_URL = https://bhkntsmylvngaawjzvnq.supabase.co
SUPABASE_SERVICE_ROLE_KEY = sb_secret_xxxxx
N8N_BASE_URL = https://artha.loophole.site
N8N_ORCHESTRATOR_WEBHOOK_URL = https://artha.loophole.site/webhook/orchestrator
NEXT_PUBLIC_APP_NAME = ARTECH
NEXT_PUBLIC_SUPABASE_URL = https://bhkntsmylvngaawjzvnq.supabase.co

Ganti PASSWORD dengan database password Supabase Anda.
URL-encode karakter special: * = %2A, @ = %40, # = %23

### Langkah 4: Deploy
Klik Deploy. Tunggu 2-3 menit.

---

## 🗄️ Setup Database (PILIH SALAH SATU)

### OPSI A: Chromebook / Tanpa Install (PALING GAMPANG)
1. Buka file `public/setup-database.sql`
2. Buka https://supabase.com/dashboard/project/bhkntsmylvngaawjzvnq/sql/new
3. Copy semua isi SQL, paste ke editor Supabase
4. Klik Run (tombol hijau)
5. Selesai!

### OPSI B: Terminal Linux (dengan Node.js)
```bash
cd artech-deploy
npm install
cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres.bhkntsmylvngaawjzvnq:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.bhkntsmylvngaawjzvnq:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
SUPABASE_URL="https://bhkntsmylvngaawjzvnq.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_xxxxx"
N8N_BASE_URL="https://artha.loophole.site"
N8N_ORCHESTRATOR_WEBHOOK_URL="https://artha.loophole.site/webhook/orchestrator"
NEXT_PUBLIC_APP_NAME="ARTECH"
NEXT_PUBLIC_SUPABASE_URL="https://bhkntsmylvngaawjzvnq.supabase.co"
EOF

npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

---

## 👤 Setup Owner Account (PILIH SALAH SATU)

### OPSI A: Via Browser
1. Buka URL Vercel → redirect ke /setup
2. Buat username + password (min 8 char)
3. Login

### OPSI B: Via Terminal (Linux)
```bash
cd artech-deploy
npx tsx scripts/setup-owner.ts
# Atau langsung: npx tsx scripts/setup-owner.ts username password
```

---

## 🔑 Ganti Password / Username (PILIH SALAH SATU)

### OPSI A: Via Terminal Linux
```bash
cd artech-deploy
npx tsx scripts/change-password.ts
# Atau: npx tsx scripts/change-password.ts username password_baru
```

### OPSI B: Via Supabase SQL Editor
```sql
-- Ganti password (ganti PASSWORD_BARU)
UPDATE artech."User"
SET "passwordHash" = crypt('PASSWORD_BARU', gen_salt('bf', 10))
WHERE username = 'owner';
```

### OPSI C: Hapus User + Setup Ulang
```bash
cd artech-deploy
npx tsx -e "
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.accessLog.deleteMany()
  await prisma.authSession.deleteMany()
  await prisma.passkey.deleteMany()
  await prisma.user.deleteMany()
  console.log('All users deleted. Buka /setup untuk buat owner baru.')
}
main().then(() => prisma.\$disconnect())
"
```

---

## 📦 Storage Bucket Setup (untuk file upload)
1. Supabase Dashboard → Storage → New bucket
2. Name: artech-uploads, Public: No, Size limit: 50MB

## 📦 Halaman Penting
- / = Galaxy dashboard (perlu login)
- /login = Login password + Passkey
- /setup = Setup owner pertama
- /download = Download source code
- /debug = Diagnostic DB + env vars
- /setup-database.sql = File SQL untuk setup database tanpa install

## 🔐 Keamanan
- Middleware proteksi semua route kecuali /login, /setup, /download, /api/auth, /api/debug
- Setiap login (sukses/gagal) dicatat di AccessLog
- Login failed kirim notifikasi ke owner via webhook (set ownerNotifyWebhook di Settings)

## 🛠️ Scripts Terminal
- `npm run setup-owner` — Setup owner pertama via terminal
- `npm run change-password` — Ganti password owner via terminal
- `npm run db:push` — Push schema ke database
- `npm run db:seed` — Seed data default (9 agent + 17 tools)
- `npm run db:generate` — Generate Prisma client

## 📝 License
Private use.
