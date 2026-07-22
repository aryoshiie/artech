# 🚀 Deploy Artech ke GitHub + Vercel (via Terminal Linux Chromebook)

Panduan lengkap step-by-step. **Pilihan jalur**:
- **Jalur A — Production-ready** (recommended): PostgreSQL Supabase + Supabase Storage. Data persistent.
- **Jalur B — Demo cepat**: Deploy apa adanya (SQLite). Data hilang setiap redeploy (Vercel = serverless, tidak persistent).

---

## 📋 PRASYARAT — Yang Perlu Disiapkan

### 1. Akun & Credentials
- [ ] **GitHub account** + Personal Access Token (PAT)
  - Buka https://github.com/settings/tokens → "Generate new token (classic)"
  - Scope: `repo` (full control of private repos) + `workflow`
  - Copy token (hanya muncul 1x!) → simpan di password manager
- [ ] **Vercel account** (sudah punya)
- [ ] **Supabase account** (untuk Jalur A) → https://supabase.com → bikin project baru di region **Southeast Asia (Singapore)** atau **Tokyo** (terdekat dengan Indonesia)

### 2. Install CLI Tools di Chromebook Terminal
```bash
# Git (biasanya sudah ada di Chromebook Linux)
git --version || sudo apt install git -y

# GitHub CLI (opsional, lebih mudah untuk auth)
# Chromebook (Debian):
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh -y
gh auth login  # pilih GitHub.com → HTTPS → login via browser

# Vercel CLI
npm install -g vercel
# atau: bun add -g vercel
vercel login   # pakai email yang sudah terdaftar di Vercel
```

### 3. Setup Git Identity (sekali saja)
```bash
git config --global user.name "Nama Anda"
git config --global user.email "email@anda.com"
```

---

## 🅰️ JALUR A — Production-Ready (PostgreSQL Supabase)

### Step A1: Setup Supabase Database

1. **Buat project baru** di https://supabase.com/dashboard → "New project"
   - Name: `artech-prod`
   - Database password: simpan (gunakan password kuat!)
   - Region: Southeast Asia (Singapore) atau Northeast Asia (Tokyo)

2. **Ambil connection strings** dari Settings → Database:
   - **Connection pooling** (untuk DATABASE_URL): `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
   - **Direct connection** (untuk DIRECT_URL): `postgresql://postgres.[ref]:[password]@aws-0-[region].supabase.com:5432/postgres`

3. **Setup Storage bucket**:
   - Dashboard → Storage → "New bucket"
   - Name: `artech-uploads`
   - Public: No
   - Size limit: 50MB

4. **Ambil Supabase API keys**:
   - Dashboard → Settings → API
   - Project URL: `https://[ref].supabase.co`
   - service_role key: `sb_secret_...` (PENTING — jangan expose ke client!)

### Step A2: Ubah Project ke Mode Production

Dari folder project Artech, jalankan script otomatis:
```bash
# Script akan: ubah schema SQLite→PostgreSQL, restore supabase-storage.ts, buat .env.production.example
bash scripts/switch-to-production.sh
```

Atau manual:
```bash
# 1. Ubah prisma/schema.prisma — ganti provider ke postgresql
# (lihat template di bawah)

# 2. Restore src/lib/supabase-storage.ts ke versi Supabase asli
# (script akan lakukan ini)

# 3. Buat file .env.production.example (untuk referensi env vars)
```

**Template `prisma/schema.prisma` (production):**
```prisma
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

# Tambahkan @@schema("artech") di akhir SETIAP model dan enum
# Contoh:
# model Agent {
#   ...
#   @@schema("artech")
# }
```

### Step A3: Setup Database Schema

```bash
# Generate Prisma client untuk PostgreSQL
npx prisma generate

# Push schema ke Supabase
npx prisma db push

# Seed data awal (9 agent + 17 tools)
npx tsx prisma/seed.ts
```

Atau via Supabase SQL Editor:
- Buka file `public/setup-database.sql` → copy semua → paste di SQL Editor → Run

### Step A4: Buat .env.local (untuk test lokal sebelum deploy)
```bash
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].supabase.com:5432/postgres"
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_xxxxx"
NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"
NEXT_PUBLIC_APP_NAME="ARTECH"
N8N_BASE_URL="https://your-n8n.com"
EOF
```

Test lokal:
```bash
npm run dev   # atau: bun run dev
# Buka http://localhost:3000 — pastikan 9 agent muncul
```

### Step A5: Push ke GitHub

```bash
# 1. Bikin repo baru di GitHub (via browser atau gh CLI)
gh repo create artech-orchestrator --private --source=. --remote=origin --push

# ATAU manual via browser:
# - Buka https://github.com/new
# - Repository name: artech-orchestrator
# - Private (recommended)
# - Jangan centang "Add README" (sudah ada)
# - Create repository

# 2. Tambah remote (kalau manual)
git remote add origin https://github.com/USERNAME/artech-orchestrator.git

# 3. Commit semua perubahan
git add -A
git commit -m "feat: production-ready (PostgreSQL Supabase + Jarvis HUD + n8n hybrid)"

# 4. Push pertama kali
git branch -M main
git push -u origin main

# Kalau diminta password, gunakan GitHub PAT (bukan password akun!)
# Username: USERNAME-GitHub-Anda
# Password: [paste PAT]
```

### Step A6: Deploy ke Vercel

```bash
# 1. Login Vercel (kalau belum)
vercel login

# 2. Deploy preview pertama kali (dari folder project)
vercel

# Pertanyaan yang muncul:
# ? Set up and deploy "~/my-project"? → Y
# ? Which scope do you want to deploy to? → pilih akun Anda
# ? Link to existing project? → N
# ? What's your project's name? → artech-orchestrator
# ? In which directory is your code located? → ./
# ? Want to modify these settings? → N (atau Y kalau mau ubah)

# 3. Set environment variables DI VERCEL DASHBOARD
#    Buka: https://vercel.com/[username]/artech-orchestrator/settings/environment-variables
#    Tambahkan SATU PER SATU (atau pakai CLI di step 4):

# 4. Set env vars via CLI (lebih cepat):
vercel env add DATABASE_URL production
# paste: postgresql://postgres.[ref]:[password]@aws-0-... (connection pooling)

vercel env add DIRECT_URL production
# paste: postgresql://postgres.[ref]:[password]@aws-0-... (direct)

vercel env add SUPABASE_URL production
# paste: https://[ref].supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# paste: sb_secret_xxxxx

vercel env add NEXT_PUBLIC_SUPABASE_URL production
# paste: https://[ref].supabase.co

vercel env add NEXT_PUBLIC_APP_NAME production
# paste: ARTECH

vercel env add N8N_BASE_URL production
# paste: https://your-n8n.com (opsional)

# 5. Deploy ke production
vercel --prod

# Output akan berupa URL: https://artech-orchestrator-xxx.vercel.app
```

### Step A7: Setup Database di Production

```bash
# Setelah deploy, jalankan prisma db push ke database production
# (pastikan .env.local punya DATABASE_URL production)
npx prisma db push

# Atau pakai Vercel's build hook:
# Tambahkan ke vercel.json:
```

Buat file `vercel.json` di root project:
```json
{
  "buildCommand": "prisma generate && next build",
  "postinstall": "prisma generate"
}
```

### Step A8: Setup Owner Account (Login Pertama)

Buka URL production → akan redirect ke `/setup`:
- Buat username + password (min 8 karakter)
- Setelah itu login di `/login`

Atau via terminal:
```bash
npx tsx scripts/setup-owner.ts username password
```

### Step A9: Auto-Deploy Setup (Opsional —Recommended)

Di Vercel dashboard → Settings → Git:
- Pastikan "Production Branch" = `main`
- Setiap `git push origin main` → auto-deploy ke production ✨

---

## 🅱️ JALUR B — Demo Cepat (SQLite, data tidak persistent)

> ⚠️ **Peringatan**: Vercel = serverless. File system TIDAK persistent. SQLite file akan hilang setiap deploy. Hanya cocok untuk demo/preview visual.

```bash
# 1. Push ke GitHub (sama dengan Step A5)
gh repo create artech-demo --public --source=. --remote=origin --push

# 2. Deploy ke Vercel
vercel --prod

# 3. Tidak perlu set env vars (SQLite file path default)

# 4. Setiap kali buka app, database kosong lagi.
#    Untuk reseed, jalankan script seed di Vercel:
#    (tidak bisa otomatis — harus manual via API atau temp endpoint)
```

---

## 🔧 Troubleshooting

### Error: "Prisma can't reach database"
- Cek `DATABASE_URL` & `DIRECT_URL` di Vercel env vars
- Pastikan pakai connection pooling URL (port 6543) untuk `DATABASE_URL`
- Pastikan Supabase project tidak paused (free tier idle 7 hari)

### Error: "File upload failed"
- Cek `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` di env vars
- Pastikan bucket `artech-uploads` sudah dibuat di Supabase Storage
- Pastikan bucket tidak Public (security)

### Error: "Module not found: mammoth / xlsx"
```bash
# Pastikan package.json punya dependencies ini, lalu:
npm install
git add package.json package-lock.json
git commit -m "fix: add missing deps"
git push
```

### Build gagal di Vercel
```bash
# Cek build logs:
vercel inspect [deployment-url]

# Common fix: hapus .next/ dan rebuild
rm -rf .next
vercel --prod
```

### CORS error saat call n8n webhook
- Di n8n webhook node, enable "Allow CORS" atau set header:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`

### Login page tidak muncul / redirect loop
- Cek middleware di `src/middleware.ts`
- Untuk production, enable auth protection:
```typescript
// Hapus komentar // di dekat return NextResponse.redirect(url)
// agar auth aktif
```

---

## 📋 CHECKLIST FINAL

Sebelum deploy production, pastikan:
- [ ] `prisma/schema.prisma` → provider `postgresql` + `multiSchema` + `@@schema("artech")`
- [ ] `src/lib/supabase-storage.ts` → versi Supabase (bukan local)
- [ ] `.env.local` → semua env vars terisi (test lokal dulu!)
- [ ] `npx prisma db push` sukses
- [ ] `npx tsx prisma/seed.ts` sukses (9 agent ter-seed)
- [ ] `npm run build` sukses lokal (tidak ada error)
- [ ] `.gitignore` → pastikan `.env*` di-ignore (tidak ter-commit!)
- [ ] GitHub repo → private (jangan public kalau ada credentials)
- [ ] Vercel env vars → semua ter-set
- [ ] Supabase Storage bucket `artech-uploads` → sudah dibuat
- [ ] Setup owner via `/setup` setelah deploy pertama

---

## 🎯 Quick Reference Commands

```bash
# Push update terbaru ke GitHub + auto-deploy Vercel
git add -A && git commit -m "update" && git push

# Deploy manual ke Vercel (tanpa git)
vercel --prod

# Lihat logs Vercel
vercel logs [url]

# Hapus deployment lama
vercel rm [deployment-url]

# Buka dashboard
vercel open
```

---

## 📞 Butuh Bantuan?

- **Vercel docs**: https://vercel.com/docs
- **Supabase docs**: https://supabase.com/docs
- **Prisma + Vercel**: https://pris.ly/d/deploy-to-vercel
- **GitHub CLI**: https://cli.github.com/manual/

**Selamat deploy! 🚀**
