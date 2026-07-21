# ARTECH · Multi-Agent Orchestrator

Webapp pusat kendali multi-agent dengan visualisasi tata surya. Terhubung ke workflow n8n via webhook.

## 🚀 Deploy ke Vercel

### Langkah 1: Download & Extract
Download artech-deploy.zip, extract di komputer Anda.

### Langkah 2: Upload ke Vercel
1. Buka https://vercel.com/new
2. Drag & drop folder hasil extract (atau push ke GitHub lalu import repo)

### Langkah 3: Set Environment Variables (WAJIB)
Di Vercel → Settings → Environment Variables, tambah:

DATABASE_URL = postgresql://postgres.bhkntsmylvngaawjzvnq:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL = postgresql://postgres.bhkntsmylvngaawjzvnq:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
SUPABASE_URL = https://bhkntsmylvngaawjzvnq.supabase.co
SUPABASE_SERVICE_ROLE_KEY = sb_secret_xxxxx
N8N_BASE_URL = https://artha.loophole.site
N8N_ORCHESTRATOR_WEBHOOK_URL = https://artha.loophole.site/webhook/orchestrator
NEXT_PUBLIC_APP_NAME = ARTECH
NEXT_PUBLIC_SUPABASE_URL = https://bhkntsmylvngaawjzvnq.supabase.co

Ganti PASSWORD dengan database password Supabase Anda.
Jika password ada karakter * @ #, URL-encode: * = %2A, @ = %40, # = %23

### Langkah 4: Deploy
Klik Deploy. Tunggu 2-3 menit.

### Langkah 5: Setup Database (SEKALI SAJA)
Dari komputer lokal:
```bash
cd artech-deploy
cp .env.example .env
# Edit .env, isi PASSWORD Anda
bun install
bun run db:push
bun run db:seed
```

### Langkah 6: Setup Owner
1. Buka URL Vercel → redirect ke /setup
2. Buat username + password owner (min 8 char)
3. Login dengan password atau Passkey (Touch ID)

### Langkah 7: Setup Supabase Storage
1. Supabase Dashboard → Storage → New bucket
2. Name: artech-uploads, Public: No, Size limit: 50MB

## 📦 Halaman Penting
- / = Galaxy dashboard (perlu login)
- /login = Login password + Passkey
- /setup = Setup owner pertama
- /download = Download source code
- /debug = Diagnostic DB + env vars

## 🔐 Keamanan
- Middleware proteksi semua route kecuali /login, /setup, /download, /api/auth, /api/debug
- Setiap login (sukses/gagal) dicatat di AccessLog
- Login failed kirim notifikasi ke owner via webhook (set ownerNotifyWebhook di Settings)
- Session cookie httpOnly, secure, 30 hari

## 🎨 Fitur
- Login password + Passkey (WebAuthn)
- Visualisasi tata surya (9 agent)
- Chat hologram (klik planet → toggle chat)
- Voice per-agent (gender, pitch, rate)
- Edit agent via sidebar (icon pencil)
- Webhook URL otomatis per agent
- File upload via Supabase Storage
- Routing Lapis 1 (deteksi nama agent)
- Halaman debug
- Responsive (mobile + desktop)

## 📝 License
Private use.
