// prisma/seed.ts — Seed 9 agent Artech (Inti Galaksi + 8 planet) + Settings default

import { config } from "dotenv";
config({ path: ".env", override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GALACTIC_CORE = {
  id: "orchestrator",
  name: "Inti Galaksi",
  role: "Master Orchestrator",
  desc: "Bintang terbesar di jantung Bimasakti. Pusat komando galaksi — menerima instruksi umum, menentukan agent mana yang mengeksekusi, dan merangkum hasil akhir.",
  color: "#ffd96b",
  glow: "#fff8d6",
  size: 7.0,
  orbit: 0,
  duration: 0,
  ring: false,
  isCore: true,
  custom: false,
  routingKeywords: "inti,galaksi,core,matahari,orchestrator,sun,pusat,arth,artha",
  orchestratorOrder: 0,
  voicePitch: 0.9,
  voiceRate: 0.97,
  voiceGender: "male",
  voiceName: null,
};

const DEFAULT_AGENTS = [
  {
    id: "mercury", name: "Merkurius", role: "Respons Cepat",
    desc: "Menjawab pertanyaan singkat dan tugas ringan secara instan, tanpa basa-basi.",
    color: "#ad9c8e", glow: "#e8d9c8", size: 3.8, orbit: 15, duration: 9,
    voicePitch: 1.25, voiceRate: 1.15, ring: false, voiceGender: "female",
    routingKeywords: "mercury,merkurius,merkur,merk", orchestratorOrder: 1,
  },
  {
    id: "venus", name: "Venus", role: "Konten & Komunikasi",
    desc: "Menulis, menyunting, dan merapikan naskah, pesan, maupun materi komunikasi.",
    color: "#e8c99b", glow: "#fff0cf", size: 4.6, orbit: 20, duration: 14,
    voicePitch: 1.1, voiceRate: 1.0, ring: false, voiceGender: "female",
    routingKeywords: "venus", orchestratorOrder: 2,
  },
  {
    id: "earth", name: "Bumi", role: "Riset & Data",
    desc: "Mengumpulkan, meriset, dan merangkum data maupun informasi dari berbagai sumber.",
    color: "#3f7fd1", glow: "#8fd3c4", size: 5.0, orbit: 25, duration: 19,
    voicePitch: 1.0, voiceRate: 1.0, ring: false, voiceGender: "neutral",
    routingKeywords: "bumi,earth", orchestratorOrder: 3,
  },
  {
    id: "mars", name: "Mars", role: "Automasi & Eksekusi",
    desc: "Menjalankan dan memicu workflow n8n — agent yang benar-benar mengeksekusi tugas otomatis.",
    color: "#c1440e", glow: "#ff9466", size: 4.2, orbit: 30, duration: 24,
    voicePitch: 0.9, voiceRate: 1.05, ring: false, voiceGender: "male",
    routingKeywords: "mars", orchestratorOrder: 4,
  },
  {
    id: "jupiter", name: "Yupiter", role: "Reasoning Mendalam",
    desc: "Menganalisis masalah kompleks, menimbang opsi, dan mengambil keputusan strategis.",
    color: "#d9a066", glow: "#ffdca6", size: 7.6, orbit: 37, duration: 33,
    voicePitch: 0.78, voiceRate: 0.92, ring: false, voiceGender: "male",
    routingKeywords: "yupiter,jupiter,yupit", orchestratorOrder: 5,
  },
  {
    id: "saturn", name: "Saturnus", role: "Perencanaan & Jadwal",
    desc: "Mengatur prioritas, tenggat, dan rencana jangka panjang lintas agent.",
    color: "#e3c88f", glow: "#fff2cf", size: 6.6, orbit: 44, duration: 41,
    voicePitch: 0.95, voiceRate: 0.9, ring: true, voiceGender: "male",
    routingKeywords: "saturnus,saturn", orchestratorOrder: 6,
  },
  {
    id: "uranus", name: "Uranus", role: "Pengembangan & Kode",
    desc: "Menulis, meninjau, dan memperbaiki kode maupun konfigurasi teknis.",
    color: "#9fe0e0", glow: "#dcfbfb", size: 5.6, orbit: 50, duration: 48,
    voicePitch: 1.05, voiceRate: 1.0, ring: false, voiceGender: "neutral",
    routingKeywords: "uranus", orchestratorOrder: 7,
  },
  {
    id: "neptune", name: "Neptunus", role: "Monitoring & QA",
    desc: "Mengawasi kualitas hasil kerja seluruh agent dan menandai anomali.",
    color: "#3f5efb", glow: "#a9b8ff", size: 5.4, orbit: 56, duration: 55,
    voicePitch: 0.9, voiceRate: 0.95, ring: false, voiceGender: "male",
    routingKeywords: "neptunus,neptune,neptun", orchestratorOrder: 8,
  },
];

const SUBS: Record<string, Array<{ name: string; desc: string; size: number; orbit: number; duration: number; color: string }>> = {
  mercury: [
    { name: "Jawaban Instan", desc: "Menjawab pertanyaan singkat tanpa perlu reasoning panjang.", size: 0.9, orbit: 4.5, duration: 4, color: "#c4b4a4" },
    { name: "Kalkulator Cepat", desc: "Hitungan dan konversi sederhana secara langsung.", size: 0.7, orbit: 6.5, duration: 6, color: "#9a8a7a" },
  ],
  venus: [
    { name: "Penulis Naskah", desc: "Menyusun draf tulisan, pesan, dan materi komunikasi dari nol.", size: 1.0, orbit: 5, duration: 5, color: "#f5dab5" },
    { name: "Editor & Proofread", desc: "Merapikan tata bahasa, nada, dan struktur naskah yang sudah ada.", size: 0.8, orbit: 7, duration: 7, color: "#d4b58a" },
  ],
  earth: [
    { name: "Pencarian Web", desc: "Mencari informasi terkini dari internet.", size: 1.0, orbit: 5.5, duration: 5, color: "#5a9fdb" },
    { name: "Perangkum Dokumen", desc: "Membaca dan meringkas dokumen/berkas panjang.", size: 0.8, orbit: 7.5, duration: 8, color: "#6dd9b8" },
  ],
  mars: [
    { name: "Trigger Workflow", desc: "Memicu workflow n8n untuk mengeksekusi tugas otomatis.", size: 0.9, orbit: 5, duration: 4, color: "#e06535" },
    { name: "Penjadwal Tugas", desc: "Menjadwalkan eksekusi tugas berulang atau tertunda.", size: 0.7, orbit: 6.5, duration: 6, color: "#a83810" },
  ],
  jupiter: [
    { name: "Analisis Multi-Opsi", desc: "Membandingkan beberapa opsi/skenario sebelum memutuskan.", size: 1.2, orbit: 6.5, duration: 5, color: "#e8b87a" },
    { name: "Pengambil Keputusan", desc: "Menyintesis analisis menjadi rekomendasi final.", size: 1.0, orbit: 8.5, duration: 7, color: "#c49050" },
    { name: "Pemecah Masalah", desc: "Menguraikan masalah kompleks jadi langkah-langkah kecil.", size: 0.8, orbit: 10.5, duration: 9, color: "#d4a066" },
  ],
  saturn: [
    { name: "Penyusun Jadwal", desc: "Menyusun rencana dan urutan prioritas kerja.", size: 1.1, orbit: 6, duration: 6, color: "#f0d5a0" },
    { name: "Pelacak Tenggat", desc: "Memantau deadline dan mengingatkan tugas yang mendekat.", size: 0.9, orbit: 8, duration: 8, color: "#c4a870" },
  ],
  uranus: [
    { name: "Penulis Kode", desc: "Menulis fungsi, komponen, atau skrip baru.", size: 1.0, orbit: 5.5, duration: 5, color: "#b0e8e8" },
    { name: "Code Reviewer", desc: "Meninjau dan memperbaiki kode yang sudah ada.", size: 0.8, orbit: 7.5, duration: 7, color: "#80c8c8" },
  ],
  neptune: [
    { name: "Pemantau Kualitas", desc: "Mengecek hasil kerja agent lain terhadap standar kualitas.", size: 1.0, orbit: 5.5, duration: 6, color: "#6080fb" },
    { name: "Pendeteksi Anomali", desc: "Menandai hasil yang janggal atau di luar pola normal.", size: 0.8, orbit: 7.5, duration: 8, color: "#5070db" },
  ],
};

async function main() {
  console.log("🌱 Seeding Artech schema...");

  await prisma.agent.upsert({
    where: { id: GALACTIC_CORE.id },
    update: GALACTIC_CORE,
    create: GALACTIC_CORE,
  });

  for (const agent of DEFAULT_AGENTS) {
    await prisma.agent.upsert({
      where: { id: agent.id },
      update: agent,
      create: agent,
    });
    const existingTools = await prisma.tool.count({ where: { agentId: agent.id } });
    if (existingTools === 0 && SUBS[agent.id]) {
      for (const sub of SUBS[agent.id]) {
        await prisma.tool.create({
          data: {
            agentId: agent.id,
            name: sub.name,
            desc: sub.desc,
            color: sub.color,
            size: sub.size,
            orbit: sub.orbit,
            duration: sub.duration,
          },
        });
      }
    }
  }

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {
      n8nBaseUrl: "https://artha.loophole.site",
      orchestratorAgentId: "orchestrator",
      voiceEnabled: true,
      sessionIdleTimeoutMin: 30,
    },
    create: {
      id: "singleton",
      n8nBaseUrl: "https://artha.loophole.site",
      orchestratorAgentId: "orchestrator",
      voiceEnabled: true,
      sessionIdleTimeoutMin: 30,
      webhookUrl: "https://artha.loophole.site/webhook/orchestrator",
    },
  });

  console.log(`✅ Seed selesai: ${DEFAULT_AGENTS.length + 1} agent (Inti Galaksi + 8 planet), ${Object.values(SUBS).flat().length} tools`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
