# 🚀 Panduan Connect Planet Artech ke Workflow n8n

Setiap **planet** di Artech Galaxy = 1 **agent** = bisa terhubung ke 1 **workflow n8n**.

## 📋 Arsitektur

```
User chat → /api/chat → routeMessage (pilih agent) → sendToN8n()
                                                         │
                                          ┌──────────────┴──────────────┐
                                          ▼                              ▼
                                  N8N WEBHOOK MODE              LLM FALLBACK MODE
                                  (kalau webhookUrl di-set)      (kalau webhookUrl kosong)
                                          │                              │
                                          ▼                              ▼
                                  POST ke workflow n8n          z-ai-web-dev-sdk LLM
                                  → workflow proses             → persona-based reply
                                  → workflow return reply
```

## 🔧 Cara Setup — 2 Opsi

### OPSI A: Pattern Otomatis (PALING GAMPANG) — `{baseUrl}/webhook/agent-{agentId}`

1. **Set n8n Base URL di Settings**
   - Buka Artech → klik icon ⚙️ (Pengaturan) di kanan atas
   - Field **"n8n Base URL"** → isi `https://n8n-domainanda.com`
   - Klik **Simpan**
   - Sekarang tiap planet OTOMATIS dapat webhook URL: `https://n8n-domainanda.com/webhook/agent-venus`, `.../agent-mars`, dll

2. **Buat workflow n8n per agent** (9 workflow — 1 per planet)
   - Di n8n Anda, buat workflow baru
   - Tambah node **Webhook trigger**
   - Set **Path** = `agent-venus` (atau `agent-mars`, `agent-jupiter`, dst sesuai ID planet)
   - Set **Method** = `POST`
   - Tambah node AI Agent / HTTP Request / Code untuk proses pesan
   - Tambah node **Respond to Webhook** dengan reply teks
   - **Aktifkan workflow** (toggle ON di kanan atas)

3. **Selesai!** Sekarang kalau user chat ke Venus, pesan dikirim ke `https://n8n-domainanda.com/webhook/agent-venus` → workflow memproses → return reply

### OPSI B: Webhook URL Custom per Agent

1. **Buat workflow n8n** dengan webhook path apa pun (mis. `/webhook/venus-ai`)

2. **Set webhook URL di Artech**
   - Klik icon ✏️ (Edit) di samping nama planet di sidebar kiri
   - Scroll ke section **"Koneksi n8n Workflow"**
   - Isi **Webhook URL** = `https://n8n-domainanda.com/webhook/venus-ai`
   - Klik **Simpan**
   - Indikator dot akan berubah hijau (mode n8n aktif)

3. **Uji koneksi**
   - Buka chat planet tersebut
   - Kirim pesan → akan dikirim ke webhook Anda

## 🎯 ID Planet → Webhook Path

| Planet | ID | Webhook Path (Opsi A) |
|--------|-----|----------------------|
| Inti Galaksi | `orchestrator` | `/webhook/agent-orchestrator` |
| Merkurius | `mercury` | `/webhook/agent-mercury` |
| Venus | `venus` | `/webhook/agent-venus` |
| Bumi | `earth` | `/webhook/agent-earth` |
| Mars | `mars` | `/webhook/agent-mars` |
| Yupiter | `jupiter` | `/webhook/agent-jupiter` |
| Saturnus | `saturn` | `/webhook/agent-saturn` |
| Uranus | `uranus` | `/webhook/agent-uranus` |
| Neptunus | `neptune` | `/webhook/agent-neptune` |

## 📨 Format Payload yang Dikirim ke n8n

Artech mengirim `POST` ke webhook dengan body JSON:

```json
{
  "agentId": "venus",
  "agentName": "Venus",
  "role": "Konten & Komunikasi",
  "message": "tolong tulis email untuk klien",
  "sessionId": "ses_abc123",
  "mode": "bypass",
  "attachments": [
    {
      "name": "brief.pdf",
      "ext": "pdf",
      "kind": "document",
      "size": 245678,
      "url": "/upload/12345-brief.pdf",
      "content": null
    }
  ],
  "timestamp": "2026-07-22T14:30:00.000Z"
}
```

## 📨 Format Response yang Diharapkan dari n8n

Workflow n8n harus **Respond to Webhook** dengan salah satu format:

**Opsi 1 — String plain text:**
```json
"Halo! Email sudah saya tulis..."
```

**Opsi 2 — Object JSON:**
```json
{
  "reply": "Halo! Email sudah saya tulis...",
  "endSession": false
}
```

Field yang didukung:
- `reply` (string) — teks balasan agent (WAJIB)
- `endSession` (boolean) — `true` = akhiri sesi & kembali ke orchestrator (opsional)
- `output` / `text` / `message` — alternatif field untuk reply (opsional)

## 🧪 Contoh Workflow n8n Minimal

```
[Webhook: POST /agent-venus]
        ↓
   [Switch: cek $json.message]
        ↓                          ↓
   [AI Agent: GPT-4]          [HTTP Request: API lain]
   System: "Kamu Venus,        ↓
   agen konten & komunikasi"   ↓
        ↓                      ↓
        └─────[Respond to Webhook]─────┘
                Body: {{ $json.reply || $json.text }}
```

## ⚙️ Routing 2 Lapis (Bonus)

Artech support routing cerdas:

- **Mode Default** (tanpa sebut nama planet) → pesan ke **Inti Galaksi** (orchestrator). Orchestrator bisa forward ke planet lain via workflow n8n-nya.
- **Mode Bypass** (sebut nama planet di awal, mis. "Venus, tulis email") → pesan langsung ke planet tersebut.

**Contoh:**
- "Tulis email untuk klien" → ke Inti Galaksi (orchestrator memutuskan)
- "Venus, tulis email untuk klien" → langsung ke Venus (bypass)
- "Mars, jadwalkan email besok" → langsung ke Mars

## 🔍 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| "Webhook belum aktif" | Pastikan workflow n8n sudah di-**toggle ON** |
| Timeout 60 detik | n8n workflow terlalu lambat — optimize atau tambah timeout di `src/lib/n8n.ts` |
| CORS error | Di n8n webhook node, enable **"Allow CORS"** atau tambah header `Access-Control-Allow-Origin: *` |
| Response kosong | Pastikan node `Respond to Webhook` ada di akhir workflow & body terisi |
| Mau balik ke LLM fallback | Kosongkan webhook URL di modal Edit agent |

## 📥 Download Project

Zip project terbaru tersedia di: `/download` atau langsung `/artech-deploy.zip`

---

**Mode Hybrid**: Setiap planet bisa punya mode sendiri — Venus pakai n8n, Mars pakai LLM, Bumi pakai n8n, dst. Fleksibel sesuai kebutuhan!
