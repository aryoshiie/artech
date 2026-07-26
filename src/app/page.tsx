'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { startRegistration } from "@simplewebauthn/browser";
import {
  Settings, Send, Paperclip, X, Volume2, VolumeX, Power,
  Loader2, CheckCircle2, AlertCircle,
  Trash2, FileText, File as FileIcon, Menu, Orbit, Plus, Pencil,
  MessageCircle, ChevronLeft, Copy, KeyRound, Fingerprint, LogOut,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface Agent {
  id: string;
  name: string;
  role: string;
  desc: string;
  color: string;
  glow: string;
  size: number;
  orbit: number;
  duration: number;
  ring: boolean;
  isCore: boolean;
  custom: boolean;
  routingKeywords?: string | null;
  orchestratorOrder: number;
  voicePitch: number;
  voiceRate: number;
  voiceGender?: string | null;
  voiceName?: string | null;
  webhookUrl?: string | null;
  workflowId?: string | null;
  xp: number;
  level: number;
  tools?: Tool[];
}

/* ------------------------------------------------------------------ */
/*  FALLBACK DEFAULT AGENTS — dipakai kalau DB belum ter-setup         */
/*  (supaya UI tetap muncul, bukan blank "Gagal memuat data")         */
/* ------------------------------------------------------------------ */

const FALLBACK_CORE: Agent = {
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
  webhookUrl: null,
  workflowId: null,
  xp: 0,
  level: 1,
  tools: [],
};

const FALLBACK_AGENTS: Agent[] = [
  { id: "mercury", name: "Merkurius", role: "Respons Cepat", desc: "Menjawab pertanyaan singkat dan tugas ringan secara instan, tanpa basa-basi.", color: "#ad9c8e", glow: "#e8d9c8", size: 3.8, orbit: 15, duration: 9, ring: false, isCore: false, custom: false, routingKeywords: "mercury,merkurius,merkur,merk", orchestratorOrder: 1, voicePitch: 1.25, voiceRate: 1.15, voiceGender: "female", voiceName: null, webhookUrl: null, workflowId: null, xp: 0, level: 1, tools: [] },
  { id: "venus", name: "Venus", role: "Konten & Komunikasi", desc: "Menulis, menyunting, dan merapikan naskah, pesan, maupun materi komunikasi.", color: "#e8c99b", glow: "#fff0cf", size: 4.6, orbit: 20, duration: 14, ring: false, isCore: false, custom: false, routingKeywords: "venus", orchestratorOrder: 2, voicePitch: 1.1, voiceRate: 1.0, voiceGender: "female", voiceName: null, webhookUrl: null, workflowId: null, xp: 0, level: 1, tools: [] },
  { id: "earth", name: "Bumi", role: "Riset & Data", desc: "Mengumpulkan, meriset, dan merangkum data maupun informasi dari berbagai sumber.", color: "#3f7fd1", glow: "#8fd3c4", size: 5.0, orbit: 25, duration: 19, ring: false, isCore: false, custom: false, routingKeywords: "bumi,earth", orchestratorOrder: 3, voicePitch: 1.0, voiceRate: 1.0, voiceGender: "neutral", voiceName: null, webhookUrl: null, workflowId: null, xp: 0, level: 1, tools: [] },
  { id: "mars", name: "Mars", role: "Automasi & Eksekusi", desc: "Menjalankan dan memicu workflow n8n — agent yang benar-benar mengeksekusi tugas otomatis.", color: "#c1440e", glow: "#ff9466", size: 4.2, orbit: 30, duration: 24, ring: false, isCore: false, custom: false, routingKeywords: "mars", orchestratorOrder: 4, voicePitch: 0.9, voiceRate: 1.05, voiceGender: "male", voiceName: null, webhookUrl: null, workflowId: null, xp: 0, level: 1, tools: [] },
  { id: "jupiter", name: "Yupiter", role: "Reasoning Mendalam", desc: "Menganalisis masalah kompleks, menimbang opsi, dan mengambil keputusan strategis.", color: "#d9a066", glow: "#ffdca6", size: 7.6, orbit: 37, duration: 33, ring: false, isCore: false, custom: false, routingKeywords: "yupiter,jupiter,yupit", orchestratorOrder: 5, voicePitch: 0.78, voiceRate: 0.92, voiceGender: "male", voiceName: null, webhookUrl: null, workflowId: null, xp: 0, level: 1, tools: [] },
  { id: "saturn", name: "Saturnus", role: "Perencanaan & Jadwal", desc: "Mengatur prioritas, tenggat, dan rencana jangka panjang lintas agent.", color: "#e3c88f", glow: "#fff2cf", size: 6.6, orbit: 44, duration: 41, ring: true, isCore: false, custom: false, routingKeywords: "saturnus,saturn", orchestratorOrder: 6, voicePitch: 0.95, voiceRate: 0.9, voiceGender: "male", voiceName: null, webhookUrl: null, workflowId: null, xp: 0, level: 1, tools: [] },
  { id: "uranus", name: "Uranus", role: "Pengembangan & Kode", desc: "Menulis, meninjau, dan memperbaiki kode maupun konfigurasi teknis.", color: "#9fe0e0", glow: "#dcfbfb", size: 5.6, orbit: 50, duration: 48, ring: false, isCore: false, custom: false, routingKeywords: "uranus", orchestratorOrder: 7, voicePitch: 1.05, voiceRate: 1.0, voiceGender: "neutral", voiceName: null, webhookUrl: null, workflowId: null, xp: 0, level: 1, tools: [] },
  { id: "neptune", name: "Neptunus", role: "Monitoring & QA", desc: "Mengawasi kualitas hasil kerja seluruh agent dan menandai anomali.", color: "#3f5efb", glow: "#a9b8ff", size: 5.4, orbit: 56, duration: 55, ring: false, isCore: false, custom: false, routingKeywords: "neptunus,neptune,neptun", orchestratorOrder: 8, voicePitch: 0.9, voiceRate: 0.95, voiceGender: "male", voiceName: null, webhookUrl: null, workflowId: null, xp: 0, level: 1, tools: [] },
];

interface Tool {
  id: string;
  name: string;
  desc: string;
  color: string;
  size: number;
  orbit: number;
  duration: number;
}

interface MessageFile {
  name: string;
  size: number;
  ext: string;
  kind: string;
  content: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  text?: string;
  files?: MessageFile[];
  timestamp: number;
}

interface AppSettings {
  webhookUrl: string;
  n8nBaseUrl: string;
  voiceEnabled: boolean;
  voiceName: string | null;
  autonomousMode: boolean;
  autonomousIntervalMin: number;
  sessionIdleTimeoutMin: number;
  // Wake word settings
  wakeWordEnabled: boolean;
  wakeWordGreetings: string;   // CSV: "selamat pagi,halo,hey,..."
  wakeWordCustom: string;      // CSV: user-defined custom wake words
  wakeWordAutoSend: boolean;   // true: auto-convert speech to text & send to agent (no drawer open)
}

interface SessionInfo {
  id: string;
  mode: "default" | "bypass";
  activeAgentId: string | null;
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

let uidCounter = 0;
function uid() { uidCounter += 1; return `id-${Date.now()}-${uidCounter}`; }

function formatTime(ts: number) {
  try { return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function formatBytes(n: number) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const AGENT_COLORS = ["#3f7fd1", "#c1440e", "#d9a066", "#9fe0e0", "#3f5efb", "#ad9c8e", "#e8c99b", "#e3c88f", "#7dd87d", "#d65db1", "#ff8a5c", "#5cb8e6"];

function slugify(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "agent";
}

function lightenColor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.min(255, ((n >> 16) & 255) + 80);
  const g = Math.min(255, ((n >> 8) & 255) + 80);
  const b = Math.min(255, (n & 255) + 80);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function generateSubs(color: string) {
  return [
    { size: 0.8 + Math.random() * 0.4, orbit: 4.5 + Math.random() * 1.5, dur: 4 + Math.floor(Math.random() * 4), color: lightenColor(color) },
    { size: 0.6 + Math.random() * 0.3, orbit: 6.5 + Math.random() * 1.5, dur: 6 + Math.floor(Math.random() * 4), color: color },
  ];
}

async function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Gagal membaca berkas"));
    r.readAsDataURL(file);
  });
}

async function processFile(file: File): Promise<MessageFile> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const base = { name: file.name, size: file.size, ext };
  try {
    if (["txt", "md", "json", "csv"].includes(ext)) {
      const text = await file.text();
      return { ...base, kind: "text", content: text.slice(0, 20000) };
    }
    if (ext === "docx") {
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      return { ...base, kind: "text", content: (result.value || "").slice(0, 20000) };
    }
    if (["xlsx", "xls"].includes(ext)) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      return { ...base, kind: "text", content: csv.slice(0, 20000) };
    }
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
      const dataUrl = await readAsDataUrl(file);
      return { ...base, kind: "image", content: dataUrl };
    }
    const dataUrl = await readAsDataUrl(file);
    return { ...base, kind: "binary", content: dataUrl };
  } catch (e: any) {
    return { ...base, kind: "error", content: String((e && e.message) || e) };
  }
}

/* ---- Voice gender guessing (browser voices tidak punya field gender) ---- */
const FEMALE_VOICE_NAMES = ["female", "wanita", "woman", "perempuan", "zira", "susan", "samantha", "victoria", "fiona", "tessa", "serena", "karen", "moira", "veena", "rishi", "google indonesia female", "google bahasa indonesia female", "Damayanti"];
const MALE_VOICE_NAMES = ["male", "pria", "man", "laki", "david", "mark", "george", "daniel", "alex", "fred", "tom", "diego", "jorge", "ardi", "andika", "google indonesia male", "google bahasa indonesia male"];

function guessVoiceGender(voice: SpeechSynthesisVoice): "male" | "female" | "neutral" {
  const name = (voice.name || "").toLowerCase();
  if (FEMALE_VOICE_NAMES.some((n) => name.includes(n.toLowerCase()))) return "female";
  if (MALE_VOICE_NAMES.some((n) => name.includes(n.toLowerCase()))) return "male";
  return "neutral";
}

/* ---- Pilih voice berdasarkan gender + lang preference ---- */
function pickVoiceByGender(
  voices: SpeechSynthesisVoice[],
  gender: string | null | undefined,
  preferLang = "id"
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  // Kalau gender neutral atau tidak set, cari voice preferLang saja
  if (!gender || gender === "neutral") {
    const idVoice = voices.find((v) => v.lang?.toLowerCase().startsWith(preferLang));
    if (idVoice) return idVoice;
    return voices[0] || null;
  }
  // Filter by gender
  const filtered = voices.filter((v) => guessVoiceGender(v) === gender);
  if (filtered.length === 0) {
    // Tidak ada voice yang match gender, fallback ke neutral
    const idVoice = voices.find((v) => v.lang?.toLowerCase().startsWith(preferLang));
    return idVoice || voices[0] || null;
  }
  // Prefer voice preferLang di antara yang match gender
  const idFiltered = filtered.find((v) => v.lang?.toLowerCase().startsWith(preferLang));
  if (idFiltered) return idFiltered;
  return filtered[0];
}

/* ------------------------------------------------------------------ */
/*  VISUALIZER — canvas radial, bereaksi terhadap status bicara agent  */
/* ------------------------------------------------------------------ */

function Visualizer({ active, color, size = 96 }: { active: boolean; color: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const bars = 32;

    function draw() {
      if (!ctx) return;
      phaseRef.current += active ? 0.22 : 0.015;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2;
      const baseR = size * 0.26;
      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2;
        const wobble = Math.sin(phaseRef.current * 3 + i * 0.65) * 0.5 + 0.5;
        const jitter = active ? Math.random() * 0.18 : 0;
        const amp = active ? (0.12 + wobble * 0.28 + jitter) * size : size * 0.015;
        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * (baseR + amp);
        const y2 = cy + Math.sin(angle) * (baseR + amp);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = active ? 0.85 : 0.3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.globalAlpha = active ? 0.9 : 0.5;
      ctx.arc(cx, cy, baseR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, color, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}

/* ------------------------------------------------------------------ */
/*  GALAXY FIELD — latar bimasakti                                     */
/* ------------------------------------------------------------------ */

function GalaxyField() {
  const stars = useMemo(() => {
    return Array.from({ length: 220 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: Math.random() * 1.8 + 0.2,
      d: Math.random() * 4 + 3,
      delay: Math.random() * 5,
    }));
  }, []);
  const dustStars = useMemo(() => {
    return Array.from({ length: 60 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: Math.random() * 0.8 + 0.2,
    }));
  }, []);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }} aria-hidden="true">
      <div className="galaxy-band" />
      <div className="galaxy-band galaxy-band-2" />
      <div className="nebula-blob" style={{ top: "-10%", left: "-10%", background: "radial-gradient(circle, rgba(93,60,150,0.35), transparent 65%)" }} />
      <div className="nebula-blob" style={{ bottom: "-15%", right: "-10%", background: "radial-gradient(circle, rgba(63,127,209,0.25), transparent 65%)", animationDelay: "-6s" }} />
      <div className="nebula-blob" style={{ top: "30%", right: "5%", background: "radial-gradient(circle, rgba(200,80,120,0.12), transparent 60%)", animationDelay: "-12s" }} />
      {dustStars.map((s, i) => (
        <div key={"d" + i} style={{
          position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.r, height: s.r,
          borderRadius: "50%", background: "rgba(255,255,255,0.4)",
        }} />
      ))}
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.r, height: s.r,
          borderRadius: "50%", background: "#fff",
          animation: `twinkle ${s.d}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PLANET HOLOGRAM — tekstur wireframe partikel ala proyeksi holografik */
/*  (garis lintang/bujur + jejak sirkuit + titik cahaya, warna per-agent) */
/* ------------------------------------------------------------------ */

// Generator angka acak deterministik dari seed string — supaya tekstur tiap
// planet konsisten antar render (tidak "berubah-ubah" tiap kali komponen
// re-render) tapi tetap unik untuk masing-masing agent.
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

// Durasi rotasi-diri planet (independen dari orbit) — variatif per agent
// tapi stabil (bukan random tiap render), berdasarkan hash id agent.
function selfSpinSeconds(id: string, min = 9, max = 21): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return min + (h % (max - min));
}

/* ARC REACTOR PLANET — visualisasi partikel holografik ala Jarvis/Arc Reactor.
 * 5 lapisan: core dust, inner glow ring, wavy band, outer halo, ambient dust.
 * Animasi: rotasi per-lapis + gelombang sinusoidal pada band utama.
 * Nama agent ditampilkan dinamis di pusat (mengikuti nama agent).
 * Warna mengikuti agent.color / agent.glow (bisa diubah via color slider).
 */
function ArcReactorPlanet({ seed, color, glow, name, speaking }: { seed: string; color: string; glow: string; name: string; speaking?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/earth-nasa.jpg";
    imgRef.current = img;

    const rnd = seededRandom(seed);
    const clouds = Array.from({ length: 50 }).map(() => ({
      lon: rnd() * Math.PI * 2,
      lat: (rnd() - 0.5) * Math.PI * 0.8,
      size: 2 + rnd() * 4,
      op: 0.2 + rnd() * 0.3,
    }));
    const stars = Array.from({ length: 80 }).map(() => ({
      x: rnd(), y: rnd(), size: 0.3 + rnd() * 0.8, op: 0.3 + rnd() * 0.5, phase: rnd() * Math.PI * 2,
    }));

    let raf = 0;
    const t0 = performance.now();
    let imgLoaded = false;
    img.onload = () => { imgLoaded = true; };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const size = Math.max(1, Math.min(rect.width, rect.height));
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw(now: number) {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      if (w < 1 || h < 1) { raf = requestAnimationFrame(draw); return; }
      const cx = w / 2, cy = h / 2;
      const radius = Math.max(1, Math.min(w, h) * 0.38);
      const time = (now - t0) * 0.001;

      ctx.clearRect(0, 0, w, h);

      // Stars
      for (const s of stars) {
        const sx = s.x * w, sy = s.y * h;
        const dx = sx - cx, dy = sy - cy;
        if (dx * dx + dy * dy < radius * radius * 1.2) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + s.phase);
        ctx.fillStyle = `rgba(255,255,255,${s.op * twinkle})`;
        ctx.beginPath();
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Atmosphere glow (visualizer — pulse saat speaking)
      const speakPulse = speaking ? (0.6 + 0.4 * Math.sin(time * 4)) : 1.0;
      const atmosIntensity = speaking ? 1.5 : 1.0;
      const atmosGrad = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.3);
      atmosGrad.addColorStop(0, `rgba(100, 180, 255, 0.0)`);
      atmosGrad.addColorStop(0.4, `rgba(100, 180, 255, ${0.3 * atmosIntensity * speakPulse})`);
      atmosGrad.addColorStop(1, `rgba(100, 180, 255, 0.0)`);
      ctx.fillStyle = atmosGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.3 * (speaking ? 1 + 0.05 * speakPulse : 1), 0, Math.PI * 2);
      ctx.fill();

      if (speaking) {
        const auraAlpha = Math.floor(80 + 100 * speakPulse).toString(16).padStart(2, "0");
        ctx.strokeStyle = `${glow}${auraAlpha}`;
        ctx.lineWidth = 2 + speakPulse * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (1.05 + 0.03 * speakPulse), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Earth sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      if (imgLoaded && imgRef.current) {
        const rotationSpeed = (1 / 60);
        const rotation = (time * rotationSpeed) % 1;
        const imgW = imgRef.current.naturalWidth;
        const imgH = imgRef.current.naturalHeight;
        const cropTop = 0, cropBottom = 1.0;
        const cropH = imgH * (cropBottom - cropTop);
        const drawW = radius * 2.2, drawH = radius * 2.2;
        const offsetX = -rotation * drawW;
        for (let i = -1; i <= 1; i++) {
          ctx.drawImage(imgRef.current, 0, imgH * cropTop, imgW, cropH, cx - drawW / 2 + offsetX + i * drawW, cy - drawH / 2, drawW, drawH);
        }
      } else {
        const oceanGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
        oceanGrad.addColorStop(0, "#1a5a8a"); oceanGrad.addColorStop(0.5, "#0f3d6b"); oceanGrad.addColorStop(1, "#06203f");
        ctx.fillStyle = oceanGrad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }

      // Clouds
      const cloudRotationSpeed = (1 / 60) * 0.7;
      const cloudRotation = (time * cloudRotationSpeed) % 1;
      const cloudOffsetX = -cloudRotation * radius * 2.2;
      ctx.globalAlpha = 0.4;
      for (let i = -1; i <= 1; i++) {
        for (const c of clouds) {
          const px = cx + (c.lon / (Math.PI * 2)) * radius * 2.2 + cloudOffsetX + i * radius * 2.2;
          const py = cy + c.lat * radius * 0.5;
          const dx = px - cx, dy = py - cy;
          if (dx * dx + dy * dy > radius * radius) continue;
          ctx.fillStyle = `rgba(255,255,255,${c.op})`;
          ctx.beginPath();
          ctx.arc(px, py, c.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Day/night
      const sunAngle = Math.PI * 0.3;
      const nightGrad = ctx.createLinearGradient(cx + Math.cos(sunAngle) * radius, cy + Math.sin(sunAngle) * radius, cx - Math.cos(sunAngle) * radius, cy - Math.sin(sunAngle) * radius);
      nightGrad.addColorStop(0, "rgba(0,0,0,0)"); nightGrad.addColorStop(0.5, "rgba(0,0,0,0)"); nightGrad.addColorStop(0.75, "rgba(0,0,20,0.5)"); nightGrad.addColorStop(1, "rgba(0,0,20,0.9)");
      ctx.fillStyle = nightGrad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      // Specular
      const specGrad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, 0, cx - radius * 0.35, cy - radius * 0.35, radius * 0.6);
      specGrad.addColorStop(0, "rgba(255,255,255,0.12)"); specGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = specGrad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      // Edge darkening
      const edgeGrad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius);
      edgeGrad.addColorStop(0, "rgba(0,0,0,0)"); edgeGrad.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      ctx.restore();

      // Outer ring
      ctx.strokeStyle = `${color}66`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [seed, color, glow, speaking]);

  return (
    <div className="arc-reactor-planet earth-globe" aria-hidden="true">
      <canvas ref={canvasRef} className="arc-reactor-canvas" />
      <span className="arc-reactor-ring" style={{ borderColor: `${color}55` }} />
      {speaking && <span className="arc-reactor-pulse" style={{ borderColor: `${glow}88` }} />}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  ORBIT VIEW — sistem tata surya + toggle popup per planet           */
/* ------------------------------------------------------------------ */

function SpeakingAura({ body }: { body: Agent }) {
  return (
    <span className="planet-aura" aria-hidden="true">
      <span className="aura-ping aura-ping-1" style={{ borderColor: body.glow }} />
      <span className="aura-ping aura-ping-2" style={{ borderColor: body.color }} />
      <span className="aura-field" style={{ background: `conic-gradient(from 0deg, transparent, ${body.glow}, transparent 60%, ${body.color}, transparent)` }} />
      <span className="aura-halo" style={{ background: `radial-gradient(circle, ${body.glow}55, transparent 65%)` }} />
    </span>
  );
}

interface OrbitViewProps {
  agents: Agent[];
  coreMeta: Agent;
  speakingId: string | null;
  selectedId: string | null;
  zoomedId: string | null;
  drawerAgentId: string | null;
  onSelect: (id: string) => void;
  onToggleChat: (id: string) => void;
}

function OrbitView({ agents, coreMeta, speakingId, selectedId, zoomedId, drawerAgentId, onSelect, onToggleChat }: OrbitViewProps) {
  const coreSpeaking = speakingId === coreMeta.id;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* GALACTIC CORE — bintang terbesar di pusat */}
      <button
        className={`galactic-core-btn${coreSpeaking ? " core-speaking" : ""}`}
        onClick={() => onSelect(coreMeta.id)}
        title={`${coreMeta.name} · ${coreMeta.role}`}
        style={{
          width: "14vmin", height: "14vmin",
          background: `radial-gradient(circle at 50% 50%, ${coreMeta.glow}55 0%, ${coreMeta.color}22 35%, #05060d 80%)`,
          boxShadow: selectedId === coreMeta.id || coreSpeaking
            ? `0 0 6vmin 2vmin ${coreMeta.color}88, 0 0 14vmin 5vmin ${coreMeta.color}33, inset 0 0 3vmin ${coreMeta.color}44`
            : `0 0 5vmin 1.5vmin ${coreMeta.color}66, 0 0 12vmin 4vmin ${coreMeta.color}22, inset 0 0 2vmin ${coreMeta.color}2a`,
        }}
      >
        <ArcReactorPlanet seed={coreMeta.id} color={coreMeta.color} glow={coreMeta.glow} name={coreMeta.name} speaking={coreSpeaking} />
        <span className="core-arms" style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${coreMeta.color}22 25deg, transparent 55deg, transparent 180deg, ${coreMeta.color}22 205deg, transparent 235deg)` }} />
        <span className="core-arms core-arms-2" style={{ background: `conic-gradient(from 90deg, transparent 0deg, ${coreMeta.glow}18 30deg, transparent 60deg, transparent 180deg, ${coreMeta.glow}18 210deg, transparent 240deg)` }} />
        {coreSpeaking && <SpeakingAura body={coreMeta} />}
      </button>

      {/* Toggle chat popup untuk Inti Galaksi — hanya muncul saat Inti diklik */}
      {selectedId === coreMeta.id && (
        <button
          className={`planet-toggle ${drawerAgentId === coreMeta.id ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleChat(coreMeta.id); }}
          title={drawerAgentId === coreMeta.id ? `Tutup chat ${coreMeta.name}` : `Buka chat ${coreMeta.name}`}
          style={{
            left: "calc(50% + 9vmin)",
            top: "calc(50% + 9vmin)",
            borderColor: drawerAgentId === coreMeta.id ? coreMeta.color : "rgba(255,255,255,0.25)",
            background: drawerAgentId === coreMeta.id ? `${coreMeta.color}33` : "rgba(5,6,13,0.7)",
            color: drawerAgentId === coreMeta.id ? coreMeta.color : "#eae8f5",
          }}
        >
          <MessageCircle size={14} />
        </button>
      )}

      {/* STAR SYSTEMS — setiap agent = bintang dengan toggle popup */}
      {agents.map((agent, idx) => {
        const speaking = speakingId === agent.id;
        const isSel = selectedId === agent.id;
        const isZoomed = zoomedId === agent.id;
        const isDrawer = drawerAgentId === agent.id;
        // Sudut statis per agent — planet distribusi di orbit tanpa revolusi
        const staticAngle = selfSpinSeconds(agent.id, 0, 360);
        return (
          <div key={agent.id} className="orbit-ring" style={{
            width: `${agent.orbit * 2}vmin`,
            height: `${agent.orbit * 2}vmin`,
            transform: `translate(-50%, -50%) rotate(${staticAngle}deg)`,
          }}>
            <div className="orbit-spin">
              <div
                className="planet-anchor"
                style={{ transform: `translate(-50%, -50%) rotate(${-staticAngle}deg)` }}
              >
                <button
                  className={`planet-btn star-btn${speaking ? " planet-speaking" : ""}`}
                  onClick={() => onSelect(agent.id)}
                  title={`${agent.name} · ${agent.role} · Lv.${agent.level}`}
                  style={{
                    width: `${agent.size}vmin`,
                    height: `${agent.size}vmin`,
                    transform: speaking ? undefined : (isZoomed ? "scale(2.2)" : (isDrawer ? "scale(1.5)" : "scale(1)")),
                    zIndex: (isZoomed || speaking) ? 20 : (isSel ? 10 : 1),
                    background: `radial-gradient(circle at 50% 50%, ${agent.color}33 0%, ${agent.color}11 40%, #05060d 78%)`,
                    boxShadow: speaking
                      ? `0 0 4vmin 1.5vmin ${agent.glow}, 0 0 10vmin 3vmin ${agent.color}55, inset 0 0 2vmin ${agent.color}33`
                      : isDrawer
                      ? `0 0 2.5vmin 0.8vmin ${agent.glow}cc, inset 0 0 1.5vmin ${agent.color}22`
                      : isSel
                      ? `0 0 1.6vmin 0.4vmin ${agent.glow}aa, inset 0 0 1vmin ${agent.color}1a`
                      : `0 0 0.8vmin 0.1vmin ${agent.color}66, inset 0 0 0.6vmin ${agent.color}14`,
                    transition: "transform .6s cubic-bezier(0.34,1.56,0.64,1), box-shadow .3s ease",
                  }}
                >
                  <ArcReactorPlanet seed={agent.id} color={agent.color} glow={agent.glow} name={agent.name} speaking={speaking} />
                  <span className="star-corona" style={{ background: `radial-gradient(circle, ${agent.glow}33, transparent 70%)` }} />
                  <span className="sub-system">
                    {(agent.tools || []).map((sub, si) => {
                      const toolsCount = (agent.tools || []).length;
                      const subAngle = toolsCount > 1 ? (si * 360 / toolsCount) : 0;
                      return (
                        <span key={si} className="sub-orbit-ring" style={{
                          width: `${sub.orbit * 2}vmin`,
                          height: `${sub.orbit * 2}vmin`,
                          transform: `translate(-50%, -50%) rotate(${subAngle}deg)`,
                        }}>
                          <span className="sub-orbit-spin">
                            <span className="sub-planet" style={{ width: `${sub.size}vmin`, height: `${sub.size}vmin`, background: sub.color, boxShadow: `0 0 0.4vmin ${sub.color}` }} />
                          </span>
                        </span>
                      );
                    })}
                  </span>
                  {speaking && <SpeakingAura body={agent} />}
                  {agent.ring && (
                    <span style={{
                      position: "absolute", top: "50%", left: "50%", width: "175%", height: "58%",
                      transform: "translate(-50%,-50%) rotate(-18deg)",
                      border: "0.35vmin solid rgba(255,240,207,0.55)", borderRadius: "50%",
                      pointerEvents: "none",
                    }} />
                  )}
                </button>

                {/* Toggle popup chat — di bawah planet, hanya muncul saat planet diklik (isSel) */}
                {isSel && (
                  <button
                    className={`planet-toggle ${isDrawer ? "active" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onToggleChat(agent.id); }}
                    title={isDrawer ? `Tutup chat ${agent.name}` : `Buka chat ${agent.name}`}
                    style={{
                      top: "calc(50% + 4vmin)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      borderColor: isDrawer ? agent.color : "rgba(255,255,255,0.25)",
                      background: isDrawer ? `${agent.color}33` : "rgba(5,6,13,0.7)",
                      color: isDrawer ? agent.color : "#eae8f5",
                    }}
                  >
                    <MessageCircle size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ROSTER — daftar agent (collapsible sidebar)                        */
/* ------------------------------------------------------------------ */

interface RosterProps {
  allBodies: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  connected: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddAgent: () => void;
}

function Roster({ allBodies, selectedId, onSelect, onEdit, onDelete, connected, collapsed, onToggleCollapse, onAddAgent }: RosterProps) {
  return (
    <>
      {/* Floating hamburger button — selalu visible saat roster collapsed */}
      {collapsed && (
        <button
          className="icon-btn hamburger-btn hamburger-floating"
          onClick={onToggleCollapse}
          title="Buka daftar agent"
          aria-label="Buka daftar agent"
        >
          <Menu size={18} />
        </button>
      )}
      {/* Roster panel — overlay, slide keluar saat collapsed */}
      <div className={`roster${collapsed ? " roster-collapsed" : ""}`}>
      {!collapsed && (
        <>
      <div className="roster-header">
        <span className="font-display" style={{ fontSize: 12, color: "#8683a1", letterSpacing: ".08em" }}>DAFTAR AGENT</span>
        <button className="icon-btn hamburger-btn" onClick={onToggleCollapse} title="Sembunyikan daftar" aria-label="Sembunyikan daftar">
          <Menu size={16} />
        </button>
      </div>
      <button className="pill font-mono roster-add-btn" onClick={onAddAgent} title="Tambah agent baru">
        <Plus size={12} /> Tambah Agent
      </button>
      <div className="roster-list">
        {allBodies.map((body) => {
          const isSun = body.isCore;
          const active = selectedId === body.id;
          return (
            <div
              key={body.id}
              className="roster-item"
              data-active={active}
            >
              <button
                className="roster-item-main"
                onClick={() => onSelect(body.id)}
                title={`Pilih ${body.name}`}
              >
                <span className="roster-dot" style={{ background: body.color, boxShadow: `0 0 0.8vmin ${body.color}` }} />
                <span className="roster-text">
                  <span className="roster-name font-display">{body.name}</span>
                  <span className="roster-role font-mono">{body.role}</span>
                </span>
              </button>
              <button
                className="roster-edit-btn"
                onClick={() => onEdit(body.id)}
                title={`Edit ${body.name}`}
                aria-label={`Edit ${body.name}`}
              >
                <Pencil size={12} />
              </button>
              {!isSun && (
                <button
                  className="roster-edit-btn roster-delete-btn"
                  onClick={() => {
                    if (confirm(`Hapus agent "${body.name}"? Riwayat percakapan juga akan dihapus.`)) {
                      onDelete(body.id);
                    }
                  }}
                  title={`Hapus ${body.name}`}
                  aria-label={`Hapus ${body.name}`}
                >
                  <Trash2 size={12} />
                </button>
              )}
              {isSun && (
                <span className="roster-status">
                  {connected ? <CheckCircle2 size={12} color="#5eead4" /> : <AlertCircle size={12} color="#8683a1" />}
                </span>
              )}
            </div>
          );
        })}
      </div>
        </>
      )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  FILE CHIP                                                          */
/* ------------------------------------------------------------------ */

function FileChip({ file, onRemove }: { file: MessageFile; onRemove?: () => void }) {
  return (
    <div className="file-chip">
      {file.kind === "image" ? (
        <img src={file.content} alt={file.name} />
      ) : (
        <span className="file-chip-icon">
          {file.kind === "text" ? <FileText size={14} /> : <FileIcon size={14} />}
        </span>
      )}
      <span className="file-chip-name font-mono">{file.name}</span>
      <span className="file-chip-size font-mono">{formatBytes(file.size)}</span>
      {onRemove && (
        <button onClick={onRemove} className="file-chip-remove" aria-label={`Hapus ${file.name}`}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HOLO DRAWER — panel chat hologram di tengah                        */
/*  (muncul saat toggle planet di-klik, desain hologram border putih)  */
/* ------------------------------------------------------------------ */

interface HoloDrawerProps {
  body: Agent | null;
  messages: ChatMessage[];
  open: boolean;
  onClose: () => void;
  onSend: () => void;
  input: string;
  onInputChange: (v: string) => void;
  pendingFiles: MessageFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (idx: number) => void;
  sending: boolean;
  speaking: boolean;
  voiceEnabled: boolean;
  webhookConfigured: boolean;
  onRename: (id: string) => void;
  onToggleVoice: () => void;
}

function SyncRegistryButton({ onToast }: { onToast: (s: any) => void }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/agents/sync-registry", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(`✅ ${data.message}`);
      } else {
        setResult(`❌ ${data.error || "Gagal sync"}`);
      }
    } catch (e: any) {
      setResult(`❌ Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <button
        className="btn font-mono"
        onClick={handleSync}
        disabled={syncing}
        style={{ background: "rgba(94,234,212,0.1)", borderColor: "rgba(94,234,212,0.4)", color: "#5eead4" }}
      >
        {syncing ? <Loader2 size={14} className="spin-icon" /> : <Orbit size={14} />}
        {syncing ? "Menyinkronkan..." : "Sync ke n8n Registry"}
      </button>
      {result && <p className="font-mono" style={{ fontSize: 11, marginTop: 8, color: result.startsWith("✅") ? "#5eead4" : "#ff8080" }}>{result}</p>}
    </div>
  );
}

function HoloDrawer({
  body, messages, open, onClose, onSend, input, onInputChange,
  pendingFiles, onAddFiles, onRemoveFile, sending, speaking,
  voiceEnabled, webhookConfigured, onRename, onToggleVoice,
}: HoloDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, open]);

  if (!body) return null;

  return (
    <div className={`holo-drawer ${open ? "holo-open" : ""}`} aria-hidden={!open}>
      <div className="holo-panel glass-panel">
        {/* Header */}
        <div className="holo-header">
          <div className="holo-header-title">
            <span className="roster-dot" style={{ background: body.color, boxShadow: `0 0 0.8vmin ${body.color}`, width: 10, height: 10 }} />
            <div>
              <div className="font-display" style={{ fontSize: 15 }}>{body.name}</div>
              <div className="font-mono" style={{ fontSize: 10, color: "#8683a1" }}>{body.role}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="icon-btn" onClick={onToggleVoice} title={voiceEnabled ? "Suara aktif" : "Suara nonaktif"} aria-label="Toggle suara">
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            {onRename && !body.isCore && (
              <button className="icon-btn" onClick={() => onRename(body.id)} title="Ubah agent" aria-label="Ubah agent">
                <Pencil size={13} />
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Tutup panel">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Visualizer kecil + status */}
        <div className="holo-visualizer-row">
          <Visualizer active={speaking} color={body.color} size={56} />
          <div className="font-mono" style={{ fontSize: 10, color: speaking ? body.color : "#8683a1" }}>
            {speaking ? "Mentransmisikan…" : voiceEnabled ? "Siap bicara" : "Suara nonaktif"}
          </div>
        </div>

        {!webhookConfigured && (
          <div className="warn-banner font-mono">
            <AlertCircle size={12} /> Webhook belum diatur untuk agent ini.
          </div>
        )}

        {/* Messages */}
        <div className="messages" ref={scrollRef}>
          {messages.length === 0 && (
            <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", textAlign: "center", padding: "16px 0" }}>
              Saluran terbuka. Ketik pesan atau lampirkan dokumen untuk memulai transmisi ke {body.name}.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`bubble bubble-${m.role}`}>
              {m.files && m.files.length > 0 && (
                <div className="bubble-files">
                  {m.files.map((f, i) => <FileChip key={i} file={f} />)}
                </div>
              )}
              {m.text && <div className="bubble-text">{m.text}</div>}
              <div className="bubble-time font-mono">{formatTime(m.timestamp)}</div>
            </div>
          ))}
          {sending && (
            <div className="bubble bubble-agent bubble-loading">
              <Loader2 size={12} className="spin-icon" /> memproses…
            </div>
          )}
        </div>

        {/* Pending files */}
        {pendingFiles.length > 0 && (
          <div className="pending-files">
            {pendingFiles.map((f, i) => (
              <FileChip key={i} file={f} onRemove={() => onRemoveFile(i)} />
            ))}
          </div>
        )}

        {/* Composer — tanpa mic, dengan lampiran */}
        <div className="composer">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json,.csv,.docx,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,.gif"
            multiple
            style={{ display: "none" }}
            onChange={(e) => { onAddFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
          />
          <button className="icon-btn" onClick={() => fileInputRef.current && fileInputRef.current.click()} title="Lampirkan dokumen" aria-label="Lampirkan dokumen">
            <Paperclip size={16} />
          </button>
          <input
            className="composer-input font-mono"
            placeholder={`Tulis pesan untuk ${body.name}…`}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
          />
          <button className="icon-btn icon-btn-send" onClick={onSend} title="Kirim" aria-label="Kirim" disabled={sending}>
            {sending ? <Loader2 size={14} className="spin-icon" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SETTINGS MODAL                                                     */
/* ------------------------------------------------------------------ */

interface SettingsModalProps {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onClose: () => void;
  onTest: () => void;
  testState: "idle" | "testing" | "ok" | "fail";
  onReset: () => void;
  allBodies: Agent[];
}

interface PasskeyItem {
  id: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

function SettingsModal({ settings, onChange, onClose, onTest, testState, onReset }: SettingsModalProps) {
  // --- Manajemen Passkey (WebAuthn) ---
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [pkLoading, setPkLoading] = useState(false);
  const [pkError, setPkError] = useState("");
  const [pkDeviceName, setPkDeviceName] = useState("");

  const loadPasskeys = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/passkey/list");
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data.passkeys || []);
      }
    } catch {
      /* silent — non-kritis untuk buka pengaturan */
    }
  }, []);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  async function handleAddPasskey() {
    setPkError("");
    setPkLoading(true);
    try {
      const optsRes = await fetch("/api/auth/passkey/register-options", { method: "POST" });
      const optsData = await optsRes.json();
      if (!optsRes.ok) throw new Error(optsData.error || "Gagal memulai registrasi passkey");

      const attResp = await startRegistration({ optionsJSON: optsData.options });

      const verifyRes = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: attResp, name: pkDeviceName.trim() || undefined }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Verifikasi registrasi passkey gagal");

      setPkDeviceName("");
      await loadPasskeys();
    } catch (e: any) {
      const msg = e?.message || "";
      if (e?.name === "NotAllowedError" || msg.toLowerCase().includes("cancel")) {
        // dibatalkan oleh user — tidak perlu tampilkan error
      } else {
        setPkError(msg || "Gagal menambah passkey");
      }
    } finally {
      setPkLoading(false);
    }
  }

  async function handleDeletePasskey(id: string) {
    if (!confirm("Hapus passkey ini? Perangkat ini tidak akan bisa login pakai passkey lagi.")) return;
    try {
      await fetch(`/api/auth/passkey/${id}`, { method: "DELETE" });
      await loadPasskeys();
    } catch {
      /* silent */
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="font-display" style={{ fontSize: 16 }}>Pengaturan Sistem</div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>

        <label className="field-label font-mono">n8n Base URL</label>
        <input
          className="text-input font-mono"
          placeholder="https://n8n.domainanda.com"
          value={settings.n8nBaseUrl}
          onChange={(e) => onChange({ ...settings, n8nBaseUrl: e.target.value })}
        />
        <p className="field-hint font-mono">
          URL dasar instance n8n Anda. Webhook per-agent akan di-generate: <code>{`{baseUrl}/webhook/agent-{agentId}`}</code>
        </p>

        <label className="field-label font-mono">Webhook n8n utama (fallback)</label>
        <input
          className="text-input font-mono"
          placeholder="https://n8n.domainanda.com/webhook/orchestrator"
          value={settings.webhookUrl}
          onChange={(e) => onChange({ ...settings, webhookUrl: e.target.value })}
        />

        <div className="toggle-row">
          <div>
            <div className="font-display" style={{ fontSize: 13 }}>Suara agent</div>
            <div className="field-hint font-mono">Balasan dibacakan otomatis dengan suara khas tiap agent.</div>
          </div>
          <button
            className={`switch ${settings.voiceEnabled ? "switch-on" : ""}`}
            onClick={() => onChange({ ...settings, voiceEnabled: !settings.voiceEnabled })}
            aria-label="Toggle suara"
          >
            <span className="switch-knob" />
          </button>
        </div>

        {/* ===== WAKE WORD SETTINGS ===== */}
        <div className="voice-section" style={{ marginTop: 14 }}>
          <div className="voice-section-title font-display">
            🎤 Wake Word Detection
          </div>

          <div className="toggle-row" style={{ marginBottom: 10 }}>
            <div>
              <div className="font-display" style={{ fontSize: 13 }}>Aktifkan wake word</div>
              <div className="field-hint font-mono">Deteksi suara otomatis — sebut nama agent atau greeting untuk memulai.</div>
            </div>
            <button
              className={`switch ${settings.wakeWordEnabled ? "switch-on" : ""}`}
              onClick={() => onChange({ ...settings, wakeWordEnabled: !settings.wakeWordEnabled })}
              aria-label="Toggle wake word"
            >
              <span className="switch-knob" />
            </button>
          </div>

          <div className="toggle-row" style={{ marginBottom: 10 }}>
            <div>
              <div className="font-display" style={{ fontSize: 13 }}>Auto-kirim pesan (tanpa buka chat)</div>
              <div className="field-hint font-mono">Setelah wake word terdeteksi, bicara pesan Anda → otomatis dikirim ke agent di background.</div>
            </div>
            <button
              className={`switch ${settings.wakeWordAutoSend ? "switch-on" : ""}`}
              onClick={() => onChange({ ...settings, wakeWordAutoSend: !settings.wakeWordAutoSend })}
              aria-label="Toggle auto send"
            >
              <span className="switch-knob" />
            </button>
          </div>

          <label className="field-label font-mono">Greeting wake words (pisah dengan koma)</label>
          <input
            className="text-input font-mono"
            value={settings.wakeWordGreetings}
            onChange={(e) => onChange({ ...settings, wakeWordGreetings: e.target.value })}
            placeholder="selamat pagi,halo,hey,..."
            style={{ fontSize: 11 }}
          />
          <p className="field-hint font-mono">Kata pemicu generik. Default: selamat pagi, siang, sore, malam, halo, hai, hi, hey, oi, woi.</p>

          <label className="field-label font-mono">Custom wake words (pisah dengan koma)</label>
          <input
            className="text-input font-mono"
            value={settings.wakeWordCustom}
            onChange={(e) => onChange({ ...settings, wakeWordCustom: e.target.value })}
            placeholder="hey artech,bang,assalamualaikum,..."
            style={{ fontSize: 11 }}
          />
          <p className="field-hint font-mono">Tambah kata pemicu sendiri. Nama agent otomatis terdeteksi (dinamis).</p>
        </div>
        {/* ===== END WAKE WORD SETTINGS ===== */}

        <div className="toggle-row">
          <div>
            <div className="font-display" style={{ fontSize: 13 }}>Mode otonom</div>
            <div className="field-hint font-mono">Mengirim ping berkala ke orchestrator selagi tab ini terbuka.</div>
          </div>
          <button
            className={`switch ${settings.autonomousMode ? "switch-on" : ""}`}
            onClick={() => onChange({ ...settings, autonomousMode: !settings.autonomousMode })}
            aria-label="Toggle otonom"
          >
            <span className="switch-knob" />
          </button>
        </div>
        {settings.autonomousMode && (
          <div className="advanced-row">
            <span className="font-mono" style={{ fontSize: 12 }}>Interval (menit)</span>
            <input
              type="number" min={1} className="text-input text-input-sm font-mono"
              value={settings.autonomousIntervalMin}
              onChange={(e) => onChange({ ...settings, autonomousIntervalMin: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        )}

        <div className="advanced-row">
          <span className="font-mono" style={{ fontSize: 12 }}>Idle timeout sesi (menit)</span>
          <input
            type="number" min={1} className="text-input text-input-sm font-mono"
            value={settings.sessionIdleTimeoutMin}
            onChange={(e) => onChange({ ...settings, sessionIdleTimeoutMin: Math.max(1, Number(e.target.value) || 30) })}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost font-mono" onClick={onTest} disabled={testState === "testing"}>
            {testState === "testing" ? <Loader2 size={14} className="spin-icon" /> : <Power size={14} />}
            Uji koneksi
          </button>
          <button className="btn btn-danger font-mono" onClick={onReset}>
            <Trash2 size={14} /> Reset percakapan
          </button>
        </div>
        {testState === "ok" && <p className="font-mono" style={{ color: "#5eead4", fontSize: 12 }}>Terhubung — workflow merespons.</p>}
        {testState === "fail" && <p className="font-mono" style={{ color: "#ff8080", fontSize: 12 }}>Gagal terhubung. Periksa URL dan CORS di n8n.</p>}

        {/* SYNC AGENT REGISTRY */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="font-display" style={{ fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Orbit size={14} /> Sinkronisasi n8n (Agent Registry)
          </div>
          <p className="field-hint font-mono" style={{ marginBottom: 10 }}>
            Sync data agent ke schema public Supabase. Jalankan setelah edit agent agar workflow n8n membaca daftar agent terbaru.
          </p>
          <SyncRegistryButton onToast={onChange} />
        </div>

        {/* KEAMANAN — Manajemen Passkey (WebAuthn) */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="font-display" style={{ fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <KeyRound size={14} /> Keamanan · Passkey
          </div>
          <p className="field-hint font-mono" style={{ marginBottom: 10 }}>
            Login tanpa password pakai sidik jari / Face ID / Windows Hello. Daftarkan perangkat ini sebagai passkey.
          </p>

          {passkeys.length === 0 ? (
            <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", marginBottom: 10 }}>
              Belum ada passkey terdaftar untuk akun ini.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="font-mono" style={{ fontSize: 12 }}>{pk.name || "Passkey tanpa nama"}</div>
                    <div className="font-mono" style={{ fontSize: 10, color: "#8683a1" }}>
                      Dibuat {new Date(pk.createdAt).toLocaleDateString("id-ID")}
                      {pk.lastUsedAt ? ` · terakhir dipakai ${new Date(pk.lastUsedAt).toLocaleDateString("id-ID")}` : ""}
                    </div>
                  </div>
                  <button
                    className="icon-btn"
                    style={{ width: 28, height: 28, flexShrink: 0 }}
                    onClick={() => handleDeletePasskey(pk.id)}
                    title="Hapus passkey"
                    aria-label="Hapus passkey"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="text-input font-mono text-input-sm"
              placeholder="Nama perangkat (opsional)"
              value={pkDeviceName}
              onChange={(e) => setPkDeviceName(e.target.value)}
            />
            <button className="btn font-mono" onClick={handleAddPasskey} disabled={pkLoading} style={{ flexShrink: 0 }}>
              {pkLoading ? <Loader2 size={13} className="spin-icon" /> : <Fingerprint size={13} />}
              Tambah Passkey
            </button>
          </div>
          {pkError && (
            <p className="font-mono" style={{ color: "#ff8080", fontSize: 11, marginTop: 6 }}>{pkError}</p>
          )}
        </div>

        <p className="field-hint font-mono" style={{ marginTop: 12 }}>
          Catatan: eksekusi tugas 24/7 berjalan di server n8n (Cron trigger). Tab ini hanya pusat kendali & percakapan.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ADD AGENT MODAL — generate webhook URL untuk n8n                   */
/* ------------------------------------------------------------------ */

interface AddAgentModalProps {
  onClose: () => void;
  onAdd: (data: { name: string; role: string; desc: string; color: string; voicePitch: number; voiceRate: number; voiceGender: string }) => Promise<{ agent: Agent; webhookUrl: string } | null>;
}

function AddAgentModal({ onClose, onAdd }: AddAgentModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(AGENT_COLORS[0]);
  const [voicePitch, setVoicePitch] = useState(1);
  const [voiceRate, setVoiceRate] = useState(1);
  const [voiceGender, setVoiceGender] = useState<string>("neutral");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ agent: Agent; webhookUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleAdd() {
    const trimmedName = (name || "").trim();
    if (!trimmedName) return;
    setCreating(true);
    try {
      const result = await onAdd({ name: trimmedName, role, desc, color, voicePitch, voiceRate, voiceGender });
      if (result) {
        setCreated(result);
      }
    } finally {
      setCreating(false);
    }
  }

  function copyWebhook() {
    if (!created) return;
    navigator.clipboard.writeText(created.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={created ? undefined : onClose}>
      <div className="modal glass-panel" onClick={(e) => e.stopPropagation()}>
        {created ? (
          <>
            <div className="drawer-header">
              <div className="font-display" style={{ fontSize: 16 }}>Agent "{created.agent.name}" Dibuat!</div>
              <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
            </div>
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%", margin: "0 auto 12px",
                background: `radial-gradient(circle at 35% 32%, ${created.agent.glow}, ${created.agent.color} 70%)`,
                boxShadow: `0 0 2vmin ${created.agent.color}`,
              }} />
              <p className="font-mono" style={{ fontSize: 11, color: "#8683a1", marginBottom: 16 }}>
                Agent siap digunakan. Sambungkan ke workflow n8n dengan webhook URL di bawah ini:
              </p>
              <div className="webhook-result">
                <code className="font-mono">{created.webhookUrl}</code>
                <button className="icon-btn" onClick={copyWebhook} title="Salin URL" aria-label="Salin URL">
                  {copied ? <CheckCircle2 size={14} color="#5eead4" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="webhook-steps font-mono">
                <p><b>Langkah selanjutnya:</b></p>
                <ol style={{ paddingLeft: 18, textAlign: "left", lineHeight: 1.8 }}>
                  <li>Buat workflow baru di n8n</li>
                  <li>Tambah node <b>Webhook trigger</b></li>
                  <li>Set method: <b>POST</b>, path: <code>agent-{created.agent.id}</code></li>
                  <li>Aktifkan workflow</li>
                  <li>Klik planet {created.agent.name} di galaksi → mulai chat</li>
                </ol>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="drawer-header">
              <div className="font-display" style={{ fontSize: 16 }}>Tambah Agent Baru</div>
              <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
            </div>
            <p className="field-hint font-mono" style={{ margin: "4px 0 8px" }}>Isi nama & peran. Webhook URL akan di-generate otomatis untuk disambungkan ke n8n.</p>

            <label className="field-label font-mono">Nama agent *</label>
            <input className="text-input font-mono" placeholder="mis. Lyra" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

            <label className="field-label font-mono">Peran / Role</label>
            <input className="text-input font-mono" placeholder="mis. Asisten Pribadi" value={role} onChange={(e) => setRole(e.target.value)} />

            <label className="field-label font-mono">Deskripsi</label>
            <textarea className="text-input font-mono" placeholder="Tugas agent ini..." value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} style={{ resize: "vertical", fontFamily: "inherit" }} />

            <label className="field-label font-mono">Warna bintang</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
              {AGENT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", boxShadow: color === c ? `0 0 0.8vmin ${c}` : "none" }}
                  aria-label={`Pilih warna ${c}`} />
              ))}
            </div>

            <label className="field-label font-mono">Jenis Suara</label>
            <div className="gender-row">
              <button type="button" className={`gender-btn ${voiceGender === "male" ? "active" : ""}`} onClick={() => setVoiceGender("male")}>Pria</button>
              <button type="button" className={`gender-btn ${voiceGender === "female" ? "active" : ""}`} onClick={() => setVoiceGender("female")}>Wanita</button>
              <button type="button" className={`gender-btn ${voiceGender === "neutral" ? "active" : ""}`} onClick={() => setVoiceGender("neutral")}>Netral</button>
            </div>

            <label className="field-label font-mono">Voice Pitch ({voicePitch.toFixed(2)})</label>
            <input type="range" min="0.5" max="2" step="0.05" value={voicePitch} onChange={(e) => setVoicePitch(Number(e.target.value))} style={{ width: "100%" }} />

            <label className="field-label font-mono">Voice Rate ({voiceRate.toFixed(2)})</label>
            <input type="range" min="0.5" max="2" step="0.05" value={voiceRate} onChange={(e) => setVoiceRate(Number(e.target.value))} style={{ width: "100%" }} />

            <div className="modal-actions">
              <button className="btn btn-ghost font-mono" onClick={onClose}>Batal</button>
              <button className="btn font-mono" style={{ background: "var(--ion)", borderColor: "var(--ion)", color: "#04201c" }} onClick={handleAdd} disabled={creating || !name.trim()}>
                {creating ? <Loader2 size={14} className="spin-icon" /> : <Plus size={14} />}
                {creating ? "Membuat..." : "Tambahkan"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RENAME AGENT MODAL                                                 */
/* ------------------------------------------------------------------ */

/* ---- Color helpers: HSL ↔ HEX untuk color slider per-agent ---- */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0;
  const m = hex.replace("#", "");
  if (m.length === 3) {
    r = parseInt(m[0] + m[0], 16); g = parseInt(m[1] + m[1], 16); b = parseInt(m[2] + m[2], 16);
  } else if (m.length === 6) {
    r = parseInt(m.slice(0, 2), 16); g = parseInt(m.slice(2, 4), 16); b = parseInt(m.slice(4, 6), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/* Hasilkan warna glow (lebih terang) dari color utama — dipakai sebagai halo agent */
function deriveGlow(color: string): string {
  const { h, s, l } = hexToHsl(color);
  return hslToHex(h, Math.min(100, s + 10), Math.min(90, l + 25));
}

interface RenameAgentModalProps {
  body: Agent | null;
  onClose: () => void;
  onRename: (id: string, data: {
    name: string;
    role: string;
    desc: string;
    color: string;
    glow: string;
    webhookUrl?: string | null;
    voicePitch?: number;
    voiceRate?: number;
    voiceGender?: string;
    voiceName?: string | null;
    systemPrompt?: string | null;
    userPrompt?: string | null;
    isActive?: boolean;
  }) => void;
  voices: SpeechSynthesisVoice[];
}

function RenameAgentModal({ body, onClose, onRename, voices }: RenameAgentModalProps) {
  const [name, setName] = useState(body ? body.name : "");
  const [role, setRole] = useState(body ? body.role : "");
  const [desc, setDesc] = useState(body ? body.desc : "");
  const [color, setColor] = useState(body?.color || "#5eead4");
  const [glow, setGlow] = useState(body?.glow || deriveGlow(body?.color || "#5eead4"));
  const [hue, setHue] = useState<number>(() => hexToHsl(body?.color || "#5eead4").h);
  const [sat, setSat] = useState<number>(() => hexToHsl(body?.color || "#5eead4").s);
  const [lit, setLit] = useState<number>(() => hexToHsl(body?.color || "#5eead4").l);
  const [voicePitch, setVoicePitch] = useState(body?.voicePitch ?? 1);
  const [voiceRate, setVoiceRate] = useState(body?.voiceRate ?? 1);
  const [voiceGender, setVoiceGender] = useState<string>(body?.voiceGender || "neutral");
  const [voiceName, setVoiceName] = useState<string>(body?.voiceName || "");
  const [webhookUrl, setWebhookUrl] = useState<string>(body?.webhookUrl || "");
  const [systemPrompt, setSystemPrompt] = useState<string>(body?.systemPrompt || "");
  const [userPrompt, setUserPrompt] = useState<string>(body?.userPrompt || "");
  const [isActive, setIsActive] = useState<boolean>(body?.isActive ?? true);
  const [testing, setTesting] = useState(false);

  // Sinkronisasi slider HSL → color & glow
  const applyHsl = useCallback((h: number, s: number, l: number) => {
    const newColor = hslToHex(h, s, l);
    const newGlow = hslToHex(h, Math.min(100, s + 10), Math.min(90, l + 25));
    setColor(newColor); setGlow(newGlow);
  }, []);
  const onHue = (v: number) => { setHue(v); applyHsl(v, sat, lit); };
  const onSat = (v: number) => { setSat(v); applyHsl(hue, v, lit); };
  const onLit = (v: number) => { setLit(v); applyHsl(hue, sat, v); };

  if (!body) return null;

  // Filter voices by selected gender
  const filteredVoices = voiceGender && voiceGender !== "neutral"
    ? voices.filter((v) => guessVoiceGender(v) === voiceGender)
    : voices;

  async function testVoice() {
    try {
      setTesting(true);
      const gender = voiceGender || "male";
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `Halo, saya ${name || body?.name}.`, gender }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setTesting(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => setTesting(false);
        await audio.play();
      } else {
        setTesting(false);
      }
    } catch {
      setTesting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="font-display" style={{ fontSize: 16 }}>Ubah Agent: {body.name}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>

        <label className="field-label font-mono">Nama *</label>
        <input className="text-input font-mono" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <label className="field-label font-mono">Peran</label>
        <input className="text-input font-mono" value={role} onChange={(e) => setRole(e.target.value)} />
        <label className="field-label font-mono">Deskripsi</label>
        <textarea className="text-input font-mono" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} style={{ resize: "vertical", fontFamily: "inherit" }} />

        {/* ===== COLOR SECTION — slider warna per-agent ===== */}
        <div className="color-section">
          <div className="color-section-title font-display">
            <span className="color-preview-dot" style={{ background: color, boxShadow: `0 0 10px ${color}, 0 0 20px ${glow}88` }} />
            Warna Agent
          </div>
          <div className="color-preview-row">
            <div className="color-swatch" style={{ background: `linear-gradient(135deg, ${glow}, ${color})`, boxShadow: `0 0 16px ${color}66` }} />
            <div className="font-mono color-hex">{color.toUpperCase()} <span style={{ color: "var(--dust)", marginLeft: 8 }}>{glow.toUpperCase()}</span></div>
          </div>

          <label className="field-label font-mono">Hue (Rona) — {hue}°</label>
          <input
            type="range" min="0" max="360" step="1"
            value={hue}
            onChange={(e) => onHue(Number(e.target.value))}
            className="color-slider hue-slider"
            style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
          />
          <div className="range-labels font-mono"><span>0°</span><span>360°</span></div>

          <label className="field-label font-mono">Saturasi (Ketajaman) — {sat}%</label>
          <input
            type="range" min="0" max="100" step="1"
            value={sat}
            onChange={(e) => onSat(Number(e.target.value))}
            className="color-slider"
          />
          <div className="range-labels font-mono"><span>Pudar</span><span>Vivid</span></div>

          <label className="field-label font-mono">Lightness (Kecerahan) — {lit}%</label>
          <input
            type="range" min="10" max="80" step="1"
            value={lit}
            onChange={(e) => onLit(Number(e.target.value))}
            className="color-slider"
          />
          <div className="range-labels font-mono"><span>Gelap</span><span>Terang</span></div>

          {/* Preset warna cepat */}
          <label className="field-label font-mono">Preset Cepat</label>
          <div className="color-presets">
            {[
              { name: "Cyan", c: "#5eead4" },
              { name: "Orange", c: "#ffb454" },
              { name: "Mercury", c: "#ad9c8e" },
              { name: "Venus", c: "#e8c99b" },
              { name: "Bumi", c: "#3f7fd1" },
              { name: "Mars", c: "#c1440e" },
              { name: "Jupiter", c: "#d9a066" },
              { name: "Saturn", c: "#e3c88f" },
              { name: "Uranus", c: "#9fe0e0" },
              { name: "Neptune", c: "#3f5efb" },
              { name: "Magenta", c: "#ff4fd8" },
              { name: "Lime", c: "#a3e635" },
            ].map((p) => (
              <button
                key={p.c}
                type="button"
                className="color-preset-btn"
                title={p.name}
                onClick={() => {
                  const hsl = hexToHsl(p.c);
                  setHue(hsl.h); setSat(hsl.s); setLit(hsl.l);
                  setColor(p.c); setGlow(deriveGlow(p.c));
                }}
                style={{ background: p.c, boxShadow: color.toLowerCase() === p.c.toLowerCase() ? `0 0 0 2px var(--starlight), 0 0 8px ${p.c}` : `0 0 6px ${p.c}88` }}
              />
            ))}
          </div>
          <p className="field-hint font-mono">Glow (halo) otomatis dihasilkan dari warna utama. Tiap agent bisa punya warna berbeda.</p>
        </div>
        {/* ===== END COLOR SECTION ===== */}

        {/* ===== N8N WEBHOOK SECTION — connect ke workflow n8n per agent ===== */}
        <div className="color-section">
          <div className="color-section-title font-display">
            <span className="color-preview-dot" style={{ background: webhookUrl ? "#5eead4" : "#8683a1", boxShadow: webhookUrl ? `0 0 10px #5eead4` : "none" }} />
            Koneksi n8n Workflow
          </div>
          <label className="field-label font-mono">Webhook URL (opsional — kosongkan untuk pakai LLM fallback)</label>
          <input
            className="text-input font-mono"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={`https://your-n8n.com/webhook/agent-${body?.id || "xxx"}`}
            style={{ fontSize: 11 }}
          />
          <p className="field-hint font-mono">
            {webhookUrl
              ? "✅ Mode n8n: pesan akan dikirim ke webhook ini. Workflow n8n Anda akan memproses & membalas."
              : "ℹ️ Mode LLM fallback: agent merespons via AI bawaan (z-ai-web-dev-sdk). Set webhook URL untuk connect ke workflow n8n Anda."}
          </p>
          <p className="field-hint font-mono" style={{ marginTop: 6, color: "#5eead4" }}>
            Pattern disarankan: <code>{`{n8n-base-url}/webhook/agent-{agentId}`}</code><br/>
            Contoh: <code>https://n8n.domain.com/webhook/agent-venus</code>
          </p>
        </div>
        {/* ===== END N8N WEBHOOK SECTION ===== */}

        {/* ===== N8N WEBHOOK SECTION — connect ke workflow n8n per agent ===== */}
        <div className="color-section">
          <div className="color-section-title font-display">
            <span className="color-preview-dot" style={{ background: webhookUrl ? "#5eead4" : "#8683a1", boxShadow: webhookUrl ? `0 0 10px #5eead4` : "none" }} />
            Koneksi n8n Workflow
          </div>
          <label className="field-label font-mono">Webhook URL (opsional — kosongkan jika tidak pakai n8n)</label>
          <input
            className="text-input font-mono"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={`https://your-n8n.com/webhook/agent-${body?.id || "xxx"}`}
            style={{ fontSize: 11 }}
          />
          <p className="field-hint font-mono">
            {webhookUrl
              ? "✅ Mode n8n: pesan akan dikirim ke webhook ini."
              : "ℹ️ Agent belum dikonfigurasi. Set webhook URL untuk connect ke workflow n8n Anda."}
          </p>
        </div>
        {/* ===== END N8N WEBHOOK SECTION ===== */}

        {/* ===== PROMPT CONFIGURATION SECTION (CMS for n8n) ===== */}
        <div className="voice-section">
          <div className="voice-section-title font-display">
            <Settings size={14} /> Konfigurasi Prompt (CMS)
          </div>

          <div className="toggle-row" style={{ marginBottom: 14 }}>
            <div>
              <div className="font-display" style={{ fontSize: 13 }}>Status Agent</div>
              <div className="field-hint font-mono">Jika OFF, agent tidak akan dipanggil oleh Jarvis di n8n.</div>
            </div>
            <button
              type="button"
              className={`switch ${isActive ? "switch-on" : ""}`}
              onClick={() => setIsActive(!isActive)}
              aria-label="Toggle status agent"
            >
              <span className="switch-knob" />
            </button>
          </div>

          <label className="field-label font-mono">Deskripsi Singkat (Tugas Agent)</label>
          <textarea
            className="text-input font-mono"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            style={{ resize: "vertical", fontFamily: "inherit", minHeight: 40 }}
            placeholder="Misal: Menangani riset pasar dan analisis data kompetitor."
          />

          <label className="field-label font-mono">System Prompt</label>
          <textarea
            className="text-input font-mono"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            style={{ resize: "vertical", fontFamily: "inherit", minHeight: 100 }}
            placeholder="Kamu adalah Karen, Research Specialist Artech..."
          />

          <label className="field-label font-mono">User Prompt (Template)</label>
          <textarea
            className="text-input font-mono"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            rows={6}
            style={{ resize: "vertical", fontFamily: "inherit", minHeight: 100 }}
            placeholder="=== DATA ===&#10;[DATA]&#10;&#10;=== INSTRUKSI ===&#10;[CMD]"
          />
          <p className="field-hint font-mono">Placeholder: [MEM], [DATA], [CMD], [MODE], [AGENT_LIST]</p>
        </div>
        {/* ===== END PROMPT CONFIGURATION SECTION ===== */}

        {/* ===== VOICE SETTINGS SECTION ===== */}
        <div className="voice-section">
          <div className="voice-section-title font-display">
            <Volume2 size={14} /> Pengaturan Suara
          </div>

          <label className="field-label font-mono">Jenis Suara (Gender)</label>
          <div className="gender-row">
            <button
              type="button"
              className={`gender-btn ${voiceGender === "male" ? "active" : ""}`}
              onClick={() => { setVoiceGender("male"); setVoiceName(""); }}
            >Pria</button>
            <button
              type="button"
              className={`gender-btn ${voiceGender === "female" ? "active" : ""}`}
              onClick={() => { setVoiceGender("female"); setVoiceName(""); }}
            >Wanita</button>
            <button
              type="button"
              className={`gender-btn ${voiceGender === "neutral" ? "active" : ""}`}
              onClick={() => { setVoiceGender("neutral"); setVoiceName(""); }}
            >Netral</button>
          </div>

          <label className="field-label font-mono">Voice spesifik (opsional — override gender)</label>
          <select
            className="text-input font-mono voice-select"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
          >
            <option value="">(otomatis dari gender)</option>
            {filteredVoices.map((v) => (
              <option key={v.voiceURI} value={v.name}>
                {v.name} ({v.lang}){guessVoiceGender(v) !== "neutral" ? ` [${guessVoiceGender(v)}]` : ""}
              </option>
            ))}
          </select>
          <p className="field-hint font-mono">
            {voices.length === 0
              ? "Voice belum tersedia. Buka di Chrome untuk akses Google voices (butuh internet)."
              : `${filteredVoices.length} voice tersedia untuk gender "${voiceGender}".`}
          </p>

          <label className="field-label font-mono">Tinggi Nada (Pitch) — {voicePitch.toFixed(2)}</label>
          <input
            type="range" min="0.5" max="2" step="0.05"
            value={voicePitch}
            onChange={(e) => setVoicePitch(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div className="range-labels font-mono">
            <span>Rendah</span><span>Tinggi</span>
          </div>

          <label className="field-label font-mono">Kecepatan Bicara (Rate) — {voiceRate.toFixed(2)}</label>
          <input
            type="range" min="0.5" max="2" step="0.05"
            value={voiceRate}
            onChange={(e) => setVoiceRate(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div className="range-labels font-mono">
            <span>Lambat</span><span>Cepat</span>
          </div>

          <button
            type="button"
            className="btn btn-ghost font-mono test-voice-btn"
            onClick={testVoice}
            disabled={testing}
          >
            {testing ? <Loader2 size={13} className="spin-icon" /> : <Volume2 size={13} />}
            {testing ? "Sedang bicara…" : "Test Suara"}
          </button>
        </div>
        {/* ===== END VOICE SETTINGS ===== */}

        <p className="field-hint font-mono">ID agent tidak berubah — riwayat percakapan tetap utuh.</p>
        <div className="modal-actions">
          <button className="btn btn-ghost font-mono" onClick={onClose}>Batal</button>
          <button
            className="btn font-mono"
            style={{ background: "var(--ion)", borderColor: "var(--ion)", color: "#04201c" }}
            onClick={() => onRename(body.id, {
              name, role, desc,
              color, glow,
              webhookUrl: webhookUrl || null,
              voicePitch, voiceRate, voiceGender,
              voiceName: voiceName || null,
              systemPrompt: systemPrompt || null,
              userPrompt: userPrompt || null,
              isActive,
            })}
          >
            <CheckCircle2 size={14} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  APP UTAMA                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_SETTINGS: AppSettings = {
  webhookUrl: "",
  n8nBaseUrl: "https://artha.loophole.site",
  voiceEnabled: true,
  voiceName: null,
  autonomousMode: false,
  autonomousIntervalMin: 10,
  sessionIdleTimeoutMin: 30,
  wakeWordEnabled: true,
  wakeWordGreetings: "selamat pagi,selamat siang,selamat sore,selamat malam,halo,hai,hi,hey,oi,woi",
  wakeWordCustom: "",
  wakeWordAutoSend: true,
};

/* ------------------------------------------------------------------ */
/*  CENTRAL REACTOR LOGO — single central logo (no solar system)       */
/*  Ring berputar saat agent aktif (speaking), redup saat switch agent */
/*  Nama agent aktif tampil di tengah, dinamis.                        */
/* ------------------------------------------------------------------ */

interface CentralReactorLogoProps {
  allBodies: Agent[];
  activeAgentId: string | null;     // agent yang sedang aktif (dari sessionInfo atau selectedId)
  speakingId: string | null;        // agent yang sedang bicara
  switching: boolean;                // true saat transition switch agent
  onSelect: (id: string) => void;
  onToggleChat: (id: string) => void;
  coreMeta: Agent;
}

function CentralReactorLogo({ allBodies, activeAgentId, speakingId, switching, onSelect, onToggleChat, coreMeta }: CentralReactorLogoProps) {
  // Agent yang sedang aktif = activeAgentId || coreMeta (default ke Inti Galaksi)
  const currentId = activeAgentId || coreMeta.id;
  const current = allBodies.find((a) => a.id === currentId) || coreMeta;
  const isSpeaking = speakingId === current.id;
  // State: "active" (ring berputar cepat), "switching" (redup, ring melambat), "idle" (ring berputar lambat)
  const ringState = switching ? "switching" : (isSpeaking ? "active" : "idle");

  return (
    <div className="central-reactor-stage">
      {/* Glow ambient di belakang */}
      <div
        className="central-ambient-glow"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${current.color}${switching ? "22" : isSpeaking ? "55" : "33"} 0%, ${current.color}11 40%, transparent 70%)`,
          opacity: switching ? 0.4 : 1,
          transition: "opacity .6s ease, background .6s ease",
        }}
      />

      {/* Logo utama — klik untuk buka chat agent aktif */}
      <button
        className={`central-logo-btn ring-state-${ringState}`}
        onClick={() => onToggleChat(current.id)}
        title={`Chat dengan ${current.name} · ${current.role}`}
        aria-label={`Chat dengan ${current.name}`}
        style={{
          // Warna ring mengikuti agent aktif
          ["--agent-color" as any]: current.color,
          ["--agent-glow" as any]: current.glow,
        }}
      >
        {/* Lapisan ring (5 lapis) — kecepatan rotasi tergantung ringState */}
        <span className="cr-ring cr-ring-1" />
        <span className="cr-ring cr-ring-2" />
        <span className="cr-ring cr-ring-3" />
        <span className="cr-ring cr-ring-4" />
        <span className="cr-ring cr-ring-5" />

        {/* Tick marks di ring terluar (HUD style) */}
        <span className="cr-ticks">
          {Array.from({ length: 60 }).map((_, i) => (
            <span
              key={i}
              className="cr-tick"
              style={{ transform: `rotate(${i * 6}deg)` }}
            />
          ))}
        </span>

        {/* Core particle (Arc Reactor effect) — partikel tetap beranimasi */}
        <span className="cr-core-wrap">
          <ArcReactorPlanet
            seed={current.id}
            color={current.color}
            glow={current.glow}
            name={current.name}
            speaking={isSpeaking}
          />
        </span>

        {/* Pulse rings saat speaking */}
        {isSpeaking && (
          <>
            <span className="cr-pulse-ring cr-pulse-1" style={{ borderColor: `${current.glow}88` }} />
            <span className="cr-pulse-ring cr-pulse-2" style={{ borderColor: `${current.color}66` }} />
          </>
        )}

        {/* Status label di atas logo */}
        <span className="cr-status-label font-mono">
          {switching ? "SWITCHING…" : isSpeaking ? "● ACTIVE" : "STANDBY"}
        </span>

        {/* Name label di bawah logo (di atas role) */}
        <span className="cr-name-label font-display" style={{ color: current.glow }}>
          {current.name.toUpperCase()}
        </span>

        {/* Role label di bawah name */}
        <span className="cr-role-label font-mono" style={{ color: current.color }}>
          {current.role.toUpperCase()}
        </span>
      </button>

    </div>
  );
}

export default function ArtechOrchestrator() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [coreMeta, setCoreMeta] = useState<Agent | null>(null);
  const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const [drawerAgentId, setDrawerAgentId] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<string, MessageFile[]>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [switchingAgent, setSwitchingAgent] = useState<boolean>(false);
  const switchingTimer = useRef<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [rosterCollapsed, setRosterCollapsed] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string; key: string } | null>(null);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [renameAgentId, setRenameAgentId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef = useRef<any>(null);
  const wakeWordsRef = useRef<{ agents: Array<{ id: string; name: string; keywords: string[] }>; generics: string[] }>({ agents: [], generics: [] });
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // Refs for speech recognition callback (always latest values)
  const allBodiesRef = useRef<Agent[]>([]);
  const sessionInfoRef = useRef<SessionInfo | null>(null);
  const coreMetaRef = useRef<Agent | null>(null);
  const pendingVoiceAgentRef = useRef<string | null>(null);  // agent ID yang menunggu pesan voice
  const [voiceReply, setVoiceReply] = useState<{ agentName: string; text: string; color: string } | null>(null);
  const sessionKeyRef = useRef<string>(typeof window !== "undefined" ? (sessionStorage.getItem("artech-session-key") || `ses-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`) : "");

  // Persist sessionKey
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("artech-session-key", sessionKeyRef.current);
    }
  }, []);

  const allBodies = useMemo(() => (coreMeta ? [coreMeta, ...agents] : []), [coreMeta, agents]);

  /* ---- load agents & settings from API ---- */
  const [dbStatus, setDbStatus] = useState<"loading" | "ok" | "fallback">("loading");
  const loadData = useCallback(async () => {
    setDbStatus("loading");
    try {
      // Agents
      const agentsRes = await fetch("/api/agents");
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        const list: Agent[] = data.agents || data || [];
        if (list.length > 0) {
          const core = list.find((a: Agent) => a.isCore) || null;
          const others = list.filter((a: Agent) => !a.isCore);
          setCoreMeta(core);
          setAgents(others);
          setDbStatus("ok");
        } else {
          // DB connected tapi kosong — pakai fallback
          setCoreMeta(FALLBACK_CORE);
          setAgents(FALLBACK_AGENTS);
          setDbStatus("fallback");
        }
      } else {
        // API error — pakai fallback supaya UI tetap muncul
        setCoreMeta(FALLBACK_CORE);
        setAgents(FALLBACK_AGENTS);
        setDbStatus("fallback");
      }
      // Settings
      try {
        const settingsRes = await fetch("/api/settings");
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          // Baca wake word settings dari localStorage (frontend-only)
          const wwEnabled = typeof window !== "undefined" ? localStorage.getItem("artech-wake-word-enabled") : null;
          const wwGreetings = typeof window !== "undefined" ? localStorage.getItem("artech-wake-word-greetings") : null;
          const wwCustom = typeof window !== "undefined" ? localStorage.getItem("artech-wake-word-custom") : null;
          const wwAutoSend = typeof window !== "undefined" ? localStorage.getItem("artech-wake-word-autosend") : null;
          setSettings({
            webhookUrl: s.webhookUrl || "",
            n8nBaseUrl: s.n8nBaseUrl || "https://artha.loophole.site",
            voiceEnabled: s.voiceEnabled ?? true,
            voiceName: s.voiceName || null,
            autonomousMode: s.autonomousMode ?? false,
            autonomousIntervalMin: s.autonomousIntervalMin ?? 10,
            sessionIdleTimeoutMin: s.sessionIdleTimeoutMin ?? 30,
            wakeWordEnabled: wwEnabled !== null ? wwEnabled === "true" : true,
            wakeWordGreetings: wwGreetings !== null && wwGreetings !== "" ? wwGreetings : "selamat pagi,selamat siang,selamat sore,selamat malam,halo,hai,hi,hey,oi,woi",
            wakeWordCustom: wwCustom || "",
            wakeWordAutoSend: wwAutoSend !== null ? wwAutoSend === "true" : true,
          });
        }
      } catch { /* settings optional */ }
    } catch (e) {
      console.error("Load error:", e);
      // Fallback: pakai default agents supaya UI tetap bisa dipakai
      setCoreMeta(FALLBACK_CORE);
      setAgents(FALLBACK_AGENTS);
      setDbStatus("fallback");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ---- load voices dari browser (Chrome online voices) ---- */
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    function loadVoices() {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const showToast = useCallback((msg: string, type = "info") => {
    setToast({ msg, type, key: uid() });
    setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), 3200);
  }, []);

  const getBody = useCallback((id: string | null) => allBodies.find((b) => b.id === id) || null, [allBodies]);

  /* ---- TTS dengan Edge TTS (Microsoft Neural Voice, natural) ---- */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speak = useCallback(async (body: Agent, text: string) => {
    if (!settings.voiceEnabled) return;
    if (!text || text.trim().length === 0) return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      setSpeakingId(body.id);
      const gender = body.voiceGender || "male";
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 500), gender }),
      });
      if (!res.ok) {
        setSpeakingId(null);
        return;
      }
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeakingId(null);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setSpeakingId(null);
        URL.revokeObjectURL(audioUrl);
      };
      await audio.play();
    } catch {
      setSpeakingId(null);
    }
  }, [settings.voiceEnabled]);

  /* ---- files ---- */
  const addFiles = useCallback(async (agentId: string, files: File[]) => {
    const processed = await Promise.all(files.map(processFile));
    setPendingFiles((prev) => ({ ...prev, [agentId]: [...(prev[agentId] || []), ...processed] }));
  }, []);

  const removeFile = useCallback((agentId: string, idx: number) => {
    setPendingFiles((prev) => ({ ...prev, [agentId]: (prev[agentId] || []).filter((_, i) => i !== idx) }));
  }, []);

  /* ---- kirim pesan via /api/chat (routing Lapis 1 di backend) ---- */
  const handleSend = useCallback(async (drawerAgentId: string) => {
    const text = (inputs[drawerAgentId] || "").trim();
    const files = pendingFiles[drawerAgentId] || [];
    if (!text && files.length === 0) return;

    // Optimistic: tampilkan pesan user di drawer agent tsb
    const userMsg: ChatMessage = { id: uid(), role: "user", text, files, timestamp: Date.now() };
    setMessagesByAgent((prev) => ({
      ...prev,
      [drawerAgentId]: [...(prev[drawerAgentId] || []), userMsg].slice(-60),
    }));
    setInputs((prev) => ({ ...prev, [drawerAgentId]: "" }));
    setPendingFiles((prev) => ({ ...prev, [drawerAgentId]: [] }));
    setSending((prev) => ({ ...prev, [drawerAgentId]: true }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          files: files.map((f) => ({ name: f.name, size: f.size, ext: f.ext, kind: f.kind, content: f.content })),
          sessionKey: sessionKeyRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // Update session
      if (data.session) {
        setSessionInfo(data.session);
      }

      // Routing bisa arahkan ke agent lain — tampilkan response di agent yang benar
      const targetAgent = data.agent;
      const agentMsg: ChatMessage = {
        id: uid(),
        role: "agent",
        text: data.reply,
        timestamp: Date.now(),
      };

      if (targetAgent && targetAgent.id !== drawerAgentId) {
        // Routing pindah agent — tampilkan di agent baru
        setDrawerAgentId(targetAgent.id);
        setSelectedId(targetAgent.id);
        setMessagesByAgent((prev) => ({
          ...prev,
          [targetAgent.id]: [...(prev[targetAgent.id] || []), agentMsg].slice(-60),
        }));
        showToast(`Pesan diteruskan ke ${targetAgent.name}`, "info");
      } else {
        // Response tetap di agent yang sama
        setMessagesByAgent((prev) => ({
          ...prev,
          [drawerAgentId]: [...(prev[drawerAgentId] || []), agentMsg].slice(-60),
        }));
      }

      // Speak response
      if (targetAgent && data.reply) {
        speak(targetAgent, data.reply);
      }

      // Sinyal end session
      if (data.endSession) {
        showToast(`Sesi dengan ${targetAgent?.name || "agent"} diakhiri oleh agent.`, "info");
        setSessionInfo(null);
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: uid(),
        role: "system",
        text: `Gagal: ${err.message}`,
        timestamp: Date.now(),
      };
      setMessagesByAgent((prev) => ({
        ...prev,
        [drawerAgentId]: [...(prev[drawerAgentId] || []), errMsg].slice(-60),
      }));
    } finally {
      setSending((prev) => ({ ...prev, [drawerAgentId]: false }));
    }
  }, [inputs, pendingFiles, showToast, speak]);

  /* ---- test connection ---- */
  const testConnection = useCallback(async () => {
    if (!settings.webhookUrl) { setTestState("fail"); return; }
    setTestState("testing");
    try {
      const res = await fetch("/api/n8n/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: settings.webhookUrl }),
      });
      const data = await res.json();
      setTestState(data.ok ? "ok" : "fail");
    } catch {
      setTestState("fail");
    }
  }, [settings.webhookUrl]);

  /* ---- save settings ke API ---- */
  const saveSettings = useCallback((s: AppSettings) => {
    setSettings(s);
    // Wake word settings disimpan di localStorage (frontend-only)
    if (typeof window !== "undefined") {
      localStorage.setItem("artech-wake-word-enabled", String(s.wakeWordEnabled));
      localStorage.setItem("artech-wake-word-greetings", s.wakeWordGreetings);
      localStorage.setItem("artech-wake-word-custom", s.wakeWordCustom);
      localStorage.setItem("artech-wake-word-autosend", String(s.wakeWordAutoSend));
    }
    // Server settings (DB) — hanya field yang didukung API
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    }).catch(() => {});
  }, []);

  /* ---- reset percakapan (hapus messages) ---- */
  const resetAll = useCallback(async () => {
    if (!confirm("Hapus semua percakapan? Ini tidak bisa diundo.")) return;
    setMessagesByAgent({});
    showToast("Percakapan direset.", "info");
  }, [showToast]);

  /* ---- tambah agent (POST ke /api/agents) ---- */
  const handleAddAgent = useCallback(async (data: { name: string; role: string; desc: string; color: string; voicePitch: number; voiceRate: number; voiceGender: string }): Promise<{ agent: Agent; webhookUrl: string } | null> => {
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Gagal tambah agent", "error");
        return null;
      }
      const result = await res.json();
      // Tambahkan ke state
      const newAgent: Agent = result.agent;
      newAgent.tools = [];
      setAgents((prev) => [...prev, newAgent]);
      setMessagesByAgent((prev) => ({ ...prev, [newAgent.id]: [] }));
      showToast(`Agent "${newAgent.name}" ditambahkan ke galaksi.`, "info");
      return { agent: newAgent, webhookUrl: result.webhookUrl };
    } catch (e: any) {
      showToast(`Error: ${e.message}`, "error");
      return null;
    }
  }, [showToast]);

  /* ---- rename agent (sekaligus update voice settings) ---- */
  const handleRenameAgent = useCallback(async (agentId: string, data: {
    name: string; role: string; desc: string; color: string; glow: string; webhookUrl?: string | null;
    voicePitch?: number; voiceRate?: number; voiceGender?: string; voiceName?: string | null;
    systemPrompt?: string | null; userPrompt?: string | null; isActive?: boolean;
  }) => {
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Gagal update");
      const json = await res.json();
      const updated = json.agent || json;
      setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, ...updated } : a));
      setCoreMeta((prev) => prev && prev.id === agentId ? { ...prev, ...updated } : prev);
      setRenameAgentId(null);
      showToast(`Agent "${data.name}" disimpan.`, "info");
    } catch (e: any) {
      showToast(`Error: ${e.message}`, "error");
    }
  }, [showToast]);

  /* ---- toggle chat drawer ---- */
  const handleToggleChat = useCallback((id: string) => {
    setDrawerAgentId((cur) => cur === id ? null : id);
    setSelectedId(id);
  }, []);

  /* ---- delete agent ---- */
  const handleDeleteAgent = useCallback(async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal hapus agent");
      }
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      setCoreMeta((prev) => prev && prev.id === agentId ? null : prev);
      setDrawerAgentId((cur) => cur === agentId ? null : cur);
      setSelectedId((cur) => cur === agentId ? null : cur);
      showToast("Agent dihapus.", "info");
    } catch (e: any) {
      showToast(`Error: ${e.message}`, "error");
    }
  }, [showToast]);

  const select = (id: string) => {
    setSelectedId(id);
    setZoomedId((z) => z === id ? null : id);
    // Trigger switching effect: ring redup selama 700ms saat pindah agent
    if (selectedId !== id && selectedId !== null) {
      setSwitchingAgent(true);
      if (switchingTimer.current) clearTimeout(switchingTimer.current);
      switchingTimer.current = setTimeout(() => setSwitchingAgent(false), 700);
    }
  };

  /* ---- Send voice message in background (no drawer) ---- */
  const sendVoiceMessage = useCallback(async (agentId: string, message: string) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionKey: sessionKeyRef.current }),
      });
      if (!res.ok) throw new Error("Gagal kirim pesan voice");
      const data = await res.json();
      const reply = data.reply || "(tidak ada balasan)";
      const agentName = data.agent?.name || "Agent";
      const agentColor = data.agent?.color || "#5eead4";
      const agentGlow = data.agent?.glow || agentColor;

      // Tampilkan reply sebagai floating notification
      setVoiceReply({ agentName, text: reply, color: agentColor });
      // Auto-hide setelah 12 detik
      setTimeout(() => setVoiceReply(null), 12000);

      // Speak reply via TTS kalau voice enabled
      if (settings.voiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(reply.slice(0, 500));
          utter.lang = "id-ID";
          utter.rate = data.agent?.voiceRate ?? 1;
          utter.pitch = data.agent?.voicePitch ?? 1;
          window.speechSynthesis.speak(utter);
        } catch {}
      }

      // Update messages store supaya kalau drawer dibuka pesannya ada
      if (data.session) {
        setSessionInfo(data.session);
      }
      setMessagesByAgent((prev) => ({
        ...prev,
        [agentId]: [
          ...(prev[agentId] || []),
          { id: uid(), role: "user", text: message, timestamp: Date.now() },
          { id: uid(), role: "agent", text: reply, timestamp: Date.now() },
        ],
      }));
    } catch (e: any) {
      showToast(`Voice error: ${e.message}`, "error");
    }
  }, [settings.voiceEnabled, showToast]);

  /* ---- Wake words builder: dynamic dari allBodies + settings ---- */
  useEffect(() => {
    // Sync refs untuk speech recognition callback
    allBodiesRef.current = allBodies;
    sessionInfoRef.current = sessionInfo;
    coreMetaRef.current = coreMeta;

    const agentWords = allBodies.map((a) => {
      const keywords: string[] = [];
      if (a.name) keywords.push(a.name.toLowerCase().trim());
      if (a.routingKeywords) {
        a.routingKeywords.split(",").forEach((k) => {
          const kw = k.trim().toLowerCase();
          if (kw) keywords.push(kw);
        });
      }
      if (a.id) keywords.push(a.id.toLowerCase().trim());
      return { id: a.id, name: a.name, keywords: keywords.filter(Boolean) };
    });
    // Gabungkan greetings dari settings + custom wake words
    const greetingList = (settings.wakeWordGreetings || "")
      .split(",").map((g) => g.trim().toLowerCase()).filter(Boolean);
    const customList = (settings.wakeWordCustom || "")
      .split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
    const generics = [...greetingList, ...customList];
    wakeWordsRef.current = { agents: agentWords, generics };
  }, [allBodies, settings.wakeWordGreetings, settings.wakeWordCustom]);

  /* ---- Speech Recognition (auto-detect, continuous, no mic button) ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceError("Browser tidak support Speech Recognition. Gunakan Chrome.");
      return;
    }
    if (!settings.voiceEnabled || !settings.wakeWordEnabled) {
      // Stop recognition if voice disabled
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "id-ID";

    recognition.onstart = () => {
      setListening(true);
      setVoiceError(null);
    };

    recognition.onresult = (event: any) => {
      // Ambil hasil terakhir
      const last = event.results[event.results.length - 1];
      if (!last || !last.isFinal) return;
      const transcript = (last[0].transcript || "").toLowerCase().trim();
      if (!transcript) return;

      // Mode 1: Jika sedang menunggu pesan voice (pendingVoiceAgent), kirim transcript sebagai pesan
      if (pendingVoiceAgentRef.current) {
        const agentId = pendingVoiceAgentRef.current;
        pendingVoiceAgentRef.current = null;
        const agentBody = allBodiesRef.current.find((a) => a.id === agentId);
        showToast(`🎤 Mengirim ke ${agentBody?.name || "agent"}: "${transcript.slice(0, 40)}..."`, "info");
        // Kirim pesan ke agent di background (tanpa buka drawer)
        sendVoiceMessage(agentId, transcript);
        return;
      }

      // Mode 2: Deteksi wake word
      const { agents, generics } = wakeWordsRef.current;
      let matchedAgent: { id: string; name: string } | null = null;

      for (const ag of agents) {
        for (const kw of ag.keywords) {
          if (kw.length >= 2 && transcript.includes(kw)) {
            matchedAgent = { id: ag.id, name: ag.name };
            break;
          }
        }
        if (matchedAgent) break;
      }

      if (matchedAgent) {
        setSelectedId(matchedAgent.id);
        if (settings.wakeWordAutoSend) {
          // Auto-send mode: set pending agent, tunggu pesan berikutnya
          pendingVoiceAgentRef.current = matchedAgent.id;
          showToast(`🎤 "${matchedAgent.name}" aktif. Silakan bicara pesan Anda...`, "info");
        } else {
          // Non-auto mode: buka chat drawer
          setDrawerAgentId(matchedAgent.id);
          showToast(`🎤 Voice: "${matchedAgent.name}" terdeteksi`, "info");
        }
        return;
      }

      // Cek generic greetings
      const isGreeting = generics.some((g) => transcript.includes(g));
      if (isGreeting) {
        const si = sessionInfoRef.current;
        const cm = coreMetaRef.current;
        const ab = allBodiesRef.current;
        const targetId = si?.activeAgentId || cm?.id || (ab[0]?.id ?? null);
        if (targetId) {
          const targetBody = ab.find((a) => a.id === targetId);
          setSelectedId(targetId);
          if (settings.wakeWordAutoSend) {
            pendingVoiceAgentRef.current = targetId;
            showToast(`🎤 ${targetBody?.name || "Agent"} aktif. Silakan bicara pesan Anda...`, "info");
          } else {
            setDrawerAgentId(targetId);
            showToast(`🎤 Voice: greeting → ${targetBody?.name || "agent"}`, "info");
          }
        }
        return;
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceError("Akses mikrofon ditolak. Izinkan mikrofon di browser.");
        setListening(false);
      } else if (event.error === "no-speech") {
        // Normal — restart akan handle
      } else if (event.error === "aborted") {
        // Normal — stop manual
      } else {
        setVoiceError(`Voice error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setListening(false);
      // Auto-restart jika voice masih enabled (continuous listening)
      if (settings.voiceEnabled && settings.wakeWordEnabled && recognitionRef.current === recognition) {
        try {
          setTimeout(() => {
            try { recognition.start(); } catch {}
          }, 500);
        } catch {}
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err: any) {
      // start() throws jika sudah started — ignore
    }

    return () => {
      recognitionRef.current = null;
      try { recognition.stop(); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.voiceEnabled, settings.wakeWordEnabled, settings.wakeWordAutoSend]);

  const selectedBody = drawerAgentId ? getBody(drawerAgentId) : null;
  const selectedMessages = drawerAgentId ? (messagesByAgent[drawerAgentId] || []) : [];
  const selectedInput = drawerAgentId ? (inputs[drawerAgentId] || "") : "";
  const selectedPendingFiles = drawerAgentId ? (pendingFiles[drawerAgentId] || []) : [];
  const webhookConfigured = !!(selectedBody?.webhookUrl || settings.webhookUrl);
  const connected = !!settings.webhookUrl || !!settings.n8nBaseUrl;

  if (!ready) {
    return (
      <div className="artech-app" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} className="spin-icon" color="#5eead4" />
      </div>
    );
  }

  if (!coreMeta) {
    return (
      <div className="artech-app" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <Loader2 size={32} className="spin-icon" color="#5eead4" />
        <p className="font-mono" style={{ color: "#8683a1" }}>Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="artech-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Unbounded:wght@400;600;800&family=Manrope:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .artech-app{
          --void:#05060d; --nebula2:#1d1740; --solar:#ffb454; --ion:#5eead4;
          --starlight:#eae8f5; --dust:#8683a1;
          position:relative; min-height:100vh; width:100%; overflow:hidden;
          background: radial-gradient(ellipse at 50% -10%, var(--nebula2) 0%, var(--void) 62%);
          color: var(--starlight); font-family:'Manrope', sans-serif;
          display:flex; flex-direction:column;
        }
        .font-display{ font-family:'Unbounded', sans-serif; }
        .font-mono{ font-family:'JetBrains Mono', monospace; }
        .font-futuristic{ font-family:'Orbitron', sans-serif; }

        @keyframes twinkle{ 0%,100%{opacity:.25;} 50%{opacity:1;} }
        @keyframes drift{ 0%{transform:translate(0,0);} 50%{transform:translate(3%,-4%);} 100%{transform:translate(0,0);} }
        @keyframes spin{ from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        @keyframes spin-reverse{ from{transform:translate(-50%,-50%) rotate(0deg);} to{transform:translate(-50%,-50%) rotate(-360deg);} }
        @keyframes pulse-slow{ 0%,100%{ filter:brightness(1);} 50%{ filter:brightness(1.18);} }
        @keyframes spin-icon{ from{transform:rotate(0);} to{transform:rotate(360deg);} }
        @keyframes holo-in{ from{opacity:0; transform:translate(-50%,-50%) scale(.85);} to{opacity:1; transform:translate(-50%,-50%) scale(1);} }
        .spin-icon{ animation: spin-icon 1s linear infinite; }

        .nebula-blob{ position:absolute; width:60vmax; height:60vmax; border-radius:50%; animation: drift 22s ease-in-out infinite; }

        .topbar{ position:relative; z-index:5; display:flex; align-items:center; justify-content:space-between; padding:40px 20px 20px; border-bottom:1px solid rgba(255,255,255,0.08); }
        .brand{ display:flex; align-items:center; gap:10px; }
        .topbar{ justify-content:center; }
        .brand{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); text-align:center; pointer-events:none; }
        .brand-title{ font-size:22px; letter-spacing:.32em; font-family:'Orbitron', sans-serif; font-weight:900; }
        .brand-sub{ font-size:10px; letter-spacing:.28em; color:var(--dust); font-family:'Orbitron', sans-serif; font-weight:400; text-transform:uppercase; margin-top:2px; }
        .topbar-left{ position:absolute; left:16px; top:50%; transform:translateY(-50%); z-index:6; }
        .topbar-right{ position:absolute; right:16px; top:50%; transform:translateY(-50%); z-index:6; }
        .top-actions{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .pill{ display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.1); font-size:11px; background:transparent; color:inherit; cursor:pointer; }
        .pill:hover{ background:rgba(255,255,255,0.05); }
        .session-pill{ cursor:pointer; transition: filter .2s ease; }
        .session-pill:hover{ filter: brightness(1.25); }
        .session-dot{ width:7px; height:7px; border-radius:50%; flex-shrink:0; }

        .main{ position:relative; z-index:2; flex:1; display:flex; min-height:0; }

        /* ROSTER (sidebar) — collapsible */
        /* Roster jadi overlay — tidak menggeser orbit-stage, logo tetap di tengah */
        .roster{ position:fixed; top:0; left:0; bottom:0; z-index:40; display:flex; flex-direction:column; gap:8px; padding:70px 14px 14px; width:230px; flex-shrink:0; border-right:1px solid rgba(255,255,255,0.07); overflow:hidden; background:rgba(5,6,13,0.72); backdrop-filter:blur(10px); transition: transform .3s ease, opacity .3s ease; }
        .roster-collapsed{ transform:translateX(-100%); opacity:0; pointer-events:none; }
        .roster-header{ display:flex; align-items:center; justify-content:space-between; }
        .roster-add-btn{ width:100%; justify-content:center; color:#5eead4 !important; border-color:rgba(94,234,212,0.3) !important; }
        .roster-list{ display:flex; flex-direction:column; gap:6px; overflow-y:auto; max-height:calc(100vh - 220px); }
        .roster-list::-webkit-scrollbar{ width:4px; }
        .roster-list::-webkit-scrollbar-thumb{ background:rgba(255,255,255,0.1); border-radius:4px; }
        .roster-item{ display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:12px; border:1px solid transparent; background:transparent; color:inherit; }
        .roster-item:hover{ background:rgba(255,255,255,0.04); }
        .roster-item[data-active="true"]{ border-color:rgba(255,180,84,0.5); background:rgba(255,180,84,0.08); }
        .roster-item-main{ flex:1; display:flex; align-items:center; gap:10px; background:transparent; border:none; color:inherit; cursor:pointer; text-align:left; padding:4px 4px; min-width:0; }
        .roster-edit-btn{ background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:var(--dust); width:26px; height:26px; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition: all .2s ease; flex-shrink:0; padding:0; }
        .roster-item:hover .roster-edit-btn{ opacity:1; }
        .roster-edit-btn:hover{ background:rgba(94,234,212,0.15); border-color:var(--ion); color:var(--ion); }
        .roster-delete-btn:hover{ background:rgba(255,128,128,0.15) !important; border-color:#ff8080 !important; color:#ff8080 !important; }
        .roster-dot{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .roster-dot-btn{ width:14px; height:14px; border-radius:50%; border:none; cursor:pointer; padding:0; margin:4px 0; }
        .roster-dot-btn[data-active="true"]{ width:20px; height:20px; }
        .roster-text{ display:flex; flex-direction:column; flex:1; min-width:0; }
        .roster-name{ font-size:13px; }
        .roster-role{ font-size:10px; color:var(--dust); }
        .roster-level{ font-size:10px; color:var(--dust); }
        .roster-status{ display:flex; }

        .orbit-stage{ flex:1; position:relative; overflow:hidden; width:100%; }
        .orbit-ring{ position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); border-radius:50%; border:1px solid rgba(255,255,255,0.06); pointer-events:none; }
        .orbit-spin{ position:absolute; inset:0; }
        .planet-anchor{ position:absolute; top:0; left:50%; }
        .planet-btn{ border:none; cursor:pointer; border-radius:50%; pointer-events:auto; display:block; position:relative; }
        .planet-btn:hover{ filter:brightness(1.15); }
        .planet-btn:focus-visible{ outline:2px solid var(--ion); outline-offset:4px; }
        .galactic-core-btn{ position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); border:none; cursor:pointer; border-radius:50%; animation: pulse-slow 4s ease-in-out infinite; overflow:visible; }
        .galactic-core-btn:hover{ filter:brightness(1.1); }
        .galactic-core-btn:focus-visible{ outline:2px solid var(--ion); outline-offset:6px; }
        .core-arms{ position:absolute; inset:-80%; border-radius:50%; animation: spin 30s linear infinite; pointer-events:none; }
        .core-arms-2{ inset:-100%; animation: spin 45s linear infinite reverse; opacity:0.7; }
        .star-btn{ overflow:visible; }
        .star-corona{ position:absolute; inset:-40%; border-radius:50%; pointer-events:none; opacity:0.6; }
        /* Lapisan tekstur hologram (wireframe + partikel) — berputar sendiri (rotasi aksial),
           terpisah dari rotasi orbit sehingga planet terlihat "hidup" berputar terus-menerus. */
        .planet-core-spin{ position:absolute; inset:0; border-radius:50%; pointer-events:none; mix-blend-mode:screen; }
        .planet-hologram{ position:absolute; inset:0; width:100%; height:100%; border-radius:50%; display:block; }
        .sub-system{ position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); pointer-events:none; }
        .sub-orbit-ring{ position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); border-radius:50%; border:1px solid rgba(255,255,255,0.05); }
        .sub-orbit-spin{ position:absolute; inset:0; }
        .sub-planet{ position:absolute; top:0; left:50%; transform:translateX(-50%); border-radius:50%; }

        /* PLANET TOGGLE — ikon popup chat kecil di dekat planet */
        .planet-toggle{ position:absolute; width:30px; height:30px; border-radius:50%; border:1px solid rgba(255,255,255,0.25); background:rgba(5,6,13,0.7); color:#eae8f5; cursor:pointer; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); z-index:5; transition: all .2s ease; }
        .planet-toggle:hover{ transform: translateX(-50%) scale(1.15); filter: brightness(1.3); }
        .planet-toggle.active{ box-shadow: 0 0 1vmin currentColor; }

        .galaxy-band{ position:absolute; width:180%; height:45%; top:28%; left:-40%; background:radial-gradient(ellipse, rgba(140,100,200,0.12), rgba(80,60,140,0.06) 50%, transparent 75%); transform:rotate(-22deg); filter:blur(30px); pointer-events:none; }
        .galaxy-band-2{ top:38%; left:-30%; width:160%; height:30%; background:radial-gradient(ellipse, rgba(200,180,255,0.08), transparent 70%); transform:rotate(-18deg); filter:blur(50px); }

        .planet-aura{ position:absolute; top:50%; left:50%; width:100%; height:100%; transform:translate(-50%,-50%); pointer-events:none; }
        .aura-ping{ position:absolute; inset:-1px; border-radius:50%; border:1.5px solid; opacity:0; animation: aura-ping 1.8s ease-out infinite; }
        .aura-ping-2{ animation-delay:0.9s; }
        .aura-field{ position:absolute; inset:-35%; border-radius:50%; opacity:0.45; mix-blend-mode:screen; animation: aura-rot 6s linear infinite; }
        .aura-halo{ position:absolute; inset:-80%; border-radius:50%; animation: aura-breath 1.4s ease-in-out infinite; }
        @keyframes aura-ping{ 0%{ transform:scale(1); opacity:0.85; } 100%{ transform:scale(2.6); opacity:0; } }
        @keyframes aura-rot{ to{ transform:rotate(360deg); } }
        @keyframes aura-breath{ 0%,100%{ opacity:0.3; transform:scale(0.9); } 50%{ opacity:0.65; transform:scale(1.15); } }

        /* KEMBANG-KEMPIS — planet "bernapas" (membesar-mengecil berulang) selagi
           agent sedang berinteraksi/berbicara dengan user. */
        @keyframes planet-breathe{ 0%,100%{ transform:scale(2.05); filter:brightness(1); } 50%{ transform:scale(2.38); filter:brightness(1.3); } }
        .planet-speaking{ animation: planet-breathe 1.1s ease-in-out infinite; }
        @keyframes core-breathe{ 0%,100%{ transform:translate(-50%,-50%) scale(1); filter:brightness(1); } 50%{ transform:translate(-50%,-50%) scale(1.14); filter:brightness(1.3); } }
        .core-speaking{ animation: pulse-slow 4s ease-in-out infinite, core-breathe 1.1s ease-in-out infinite; }

        .glass-panel{ background:linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border:1px solid rgba(255,255,255,0.09); backdrop-filter: blur(16px); }

        /* HOLO DRAWER — panel chat hologram di tengah */
        .holo-drawer{ position:fixed; bottom:20px; left:20px; z-index:30; width:380px; max-width:calc(100vw - 40px); max-height:70vh; pointer-events:none; opacity:0; transition: opacity .3s ease, transform .3s ease; transform:translateY(20px); }
        .holo-drawer.holo-open{ opacity:1; pointer-events:auto; transform:translateY(0); animation: holo-in-bl .35s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes holo-in-bl{ from{ opacity:0; transform:translateY(30px) scale(0.95); } to{ opacity:1; transform:translateY(0) scale(1); } }
        .holo-panel{ width:100%; max-height:70vh; display:flex; flex-direction:column; padding:16px; border-radius:16px; border:1.5px solid rgba(94,180,255,0.4); background:linear-gradient(135deg, rgba(10,30,60,0.92) 0%, rgba(20,50,100,0.88) 50%, rgba(10,30,70,0.92) 100%); box-shadow: 0 0 3vmin rgba(94,180,255,0.3), 0 0 1vmin rgba(94,180,255,0.15), inset 0 0 2vmin rgba(94,180,255,0.08); backdrop-filter: blur(20px); }
        .holo-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .holo-header-title{ display:flex; align-items:center; gap:10px; }
        .holo-visualizer-row{ display:flex; flex-direction:column; align-items:center; gap:4px; padding:4px 0 10px; border-bottom:1px solid rgba(255,255,255,0.07); margin-bottom:10px; }

        .warn-banner{ display:flex; align-items:center; gap:6px; font-size:11px; color:#ffcf8f; background:rgba(255,180,84,0.1); border:1px solid rgba(255,180,84,0.25); padding:6px 10px; border-radius:10px; margin-bottom:10px; }
        .messages{ flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:2px; min-height:80px; max-height:calc(78vh - 280px); }
        .messages::-webkit-scrollbar{ width:4px; }
        .messages::-webkit-scrollbar-thumb{ background:rgba(255,255,255,0.1); border-radius:4px; }
        .bubble{ max-width:88%; padding:8px 11px; border-radius:14px; font-size:13px; line-height:1.5; }
        .bubble-user{ align-self:flex-end; background:rgba(94,234,212,0.14); border:1px solid rgba(94,234,212,0.25); }
        .bubble-agent{ align-self:flex-start; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09); }
        .bubble-system{ align-self:center; background:rgba(255,120,120,0.1); border:1px solid rgba(255,120,120,0.25); font-size:11px; color:#ffb0b0; }
        .bubble-loading{ display:flex; align-items:center; gap:6px; font-size:12px; color:var(--dust); }
        .bubble-text{ white-space:pre-wrap; word-break:break-word; }
        .bubble-time{ font-size:9px; color:var(--dust); margin-top:4px; text-align:right; }
        .bubble-files{ display:flex; flex-direction:column; gap:4px; margin-bottom:6px; }

        .file-chip{ display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:4px 8px; font-size:11px; }
        .file-chip img{ width:20px; height:20px; object-fit:cover; border-radius:4px; }
        .file-chip-name{ max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .file-chip-size{ color:var(--dust); }
        .file-chip-remove{ background:none; border:none; color:var(--dust); cursor:pointer; display:flex; }
        .pending-files{ display:flex; flex-wrap:wrap; gap:6px; padding:8px 0; }

        .composer{ display:flex; align-items:center; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); }
        .composer-input{ flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:999px; padding:9px 14px; color:var(--starlight); font-size:12px; outline:none; }
        .composer-input:focus{ border-color:var(--ion); }
        .icon-btn{ background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:var(--starlight); width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; padding:0; }
        .icon-btn:hover{ background:rgba(255,255,255,0.12); }
        .icon-btn:focus-visible{ outline:2px solid var(--ion); }
        .icon-btn:disabled{ opacity:0.5; cursor:not-allowed; }
        .icon-btn-send{ background:var(--solar); border-color:var(--solar); color:#241300; }
        .icon-btn-send:hover{ background:#ffc878; }

        .modal-overlay{ position:fixed; inset:0; background:rgba(2,2,8,0.6); display:flex; align-items:center; justify-content:center; z-index:50; padding:20px; }
        .modal{ width:420px; max-width:100%; max-height:88vh; overflow-y:auto; padding:18px; border-radius:18px; }
        .field-label{ font-size:11px; color:var(--dust); display:block; margin:12px 0 6px; }
        .field-hint{ font-size:10.5px; color:var(--dust); line-height:1.5; margin:4px 0 0; }
        .text-input{ width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:9px 11px; color:var(--starlight); font-size:12px; outline:none; box-sizing:border-box; }
        .text-input:focus{ border-color:var(--ion); }
        .text-input-sm{ flex:1; padding:6px 9px; }
        textarea.text-input{ font-family:'JetBrains Mono', monospace; line-height:1.5; }
        .link-btn{ background:none; border:none; color:var(--ion); font-size:11px; cursor:pointer; padding:8px 0; text-align:left; }
        .advanced-list{ display:flex; flex-direction:column; gap:6px; margin-bottom:8px; }
        .advanced-row{ display:flex; align-items:center; gap:8px; }
        .toggle-row{ display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-top:1px solid rgba(255,255,255,0.07); gap:12px; }
        .switch{ width:40px; height:22px; border-radius:999px; background:rgba(255,255,255,0.15); border:none; position:relative; cursor:pointer; flex-shrink:0; }
        .switch-on{ background:var(--ion); }
        .switch-knob{ position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .2s ease; }
        .switch-on .switch-knob{ transform:translateX(18px); }
        .modal-actions{ display:flex; gap:8px; margin-top:16px; }
        .btn{ display:flex; align-items:center; gap:6px; padding:8px 12px; border-radius:10px; font-size:11px; cursor:pointer; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:var(--starlight); }
        .btn-danger{ color:#ffb0b0; border-color:rgba(255,120,120,0.3); }
        .btn-ghost:hover{ background:rgba(255,255,255,0.1); }

        /* WEBHOOK RESULT (di AddAgentModal) */
        .webhook-result{ display:flex; align-items:center; gap:8px; background:rgba(94,234,212,0.08); border:1px solid rgba(94,234,212,0.25); border-radius:10px; padding:8px 10px; margin-bottom:14px; }
        .webhook-result code{ flex:1; font-size:11px; color:#5eead4; word-break:break-all; }

        /* VOICE SETTINGS */
        .voice-section{ margin-top:18px; padding:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; }
        .voice-section-title{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ion); margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .gender-row{ display:flex; gap:6px; margin-bottom:4px; }
        .gender-btn{ flex:1; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:var(--starlight); font-size:11px; cursor:pointer; font-family:'JetBrains Mono', monospace; transition: all .2s ease; }
        .gender-btn:hover{ background:rgba(255,255,255,0.08); }
        .gender-btn.active{ background:rgba(94,234,212,0.15); border-color:var(--ion); color:var(--ion); }
        .voice-select{ appearance:auto; cursor:pointer; }
        .range-labels{ display:flex; justify-content:space-between; font-size:9px; color:var(--dust); margin-top:2px; margin-bottom:8px; }
        .test-voice-btn{ margin-top:8px; width:100%; justify-content:center; }
        .webhook-steps{ font-size:11px; color:var(--dust); text-align:left; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px; margin-top:8px; }
        .webhook-steps p{ margin:0 0 8px; color:var(--starlight); }
        .webhook-steps ol{ margin:0; }
        .webhook-steps code{ background:rgba(94,234,212,0.1); padding:1px 4px; border-radius:3px; color:#5eead4; font-size:10px; }

        .toast{ position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:60; padding:10px 16px; border-radius:999px; font-size:12px; }

        @media (max-width: 860px){
          .roster{ width:240px; padding-top:70px; }
          .roster-collapsed{ transform:translateX(-100%); opacity:0; pointer-events:none; }
          .holo-drawer{ width:96vw; max-width:96vw; }
          .top-actions .pill{ font-size:10px; padding:5px 8px; }
        }

        @media (prefers-reduced-motion: reduce){
          *{ animation-duration:0.001ms !important; animation-iteration-count:1 !important; }
        }

        /* ===== ARC REACTOR PLANET (Jarvis-style particle visualization) ===== */
        .arc-reactor-planet{
          position:absolute; inset:0; width:100%; height:100%;
          border-radius:50%; overflow:hidden;
          container-type:size;
        }
        .arc-reactor-canvas{
          position:absolute; inset:0; width:100%; height:100%;
          display:block; border-radius:50%;
          mix-blend-mode:screen;
        }
        .arc-reactor-ring{
          position:absolute; inset:4%; border-radius:50%;
          border:1px solid rgba(255,255,255,0.12);
          pointer-events:none;
        }
        .arc-reactor-name{
          position:absolute; top:50%; left:50%;
          transform:translate(-50%,-50%);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:0.5cqw;
          font-size:13cqw; font-weight:600;
          letter-spacing:0.08em; text-transform:uppercase;
          text-align:center; line-height:1;
          pointer-events:none;
          max-width:62%; max-height:62%;
          z-index:2;
        }
        .arc-reactor-name-line{
          display:block;
          white-space:nowrap;
          animation: arc-name-fade 0.4s ease;
          position:relative; z-index:2;
        }
        .arc-reactor-name-backdrop{
          position:absolute; top:50%; left:50%;
          transform:translate(-50%,-50%);
          width:140%; height:140%;
          z-index:1;
          pointer-events:none;
          border-radius:50%;
        }
        @keyframes arc-name-fade{ from{ opacity:0; transform:translateY(2px);} to{ opacity:1; transform:translateY(0);} }
        .arc-reactor-pulse{
          position:absolute; inset:-8%; border-radius:50%;
          border:2px solid transparent;
          animation: arc-pulse 1.8s ease-out infinite;
          pointer-events:none;
        }
        @keyframes arc-pulse{
          0%{ transform:scale(0.85); opacity:0.9; }
          100%{ transform:scale(1.25); opacity:0; }
        }

        /* ===== COLOR SLIDER SECTION (per-agent color picker) ===== */
        .color-section{
          margin-top:16px; padding:14px;
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:12px;
        }
        .color-section-title{
          display:flex; align-items:center; gap:10px;
          font-size:13px; color:var(--ion);
          margin-bottom:14px; padding-bottom:8px;
          border-bottom:1px solid rgba(255,255,255,0.06);
        }
        .color-preview-dot{
          width:18px; height:18px; border-radius:50%;
          border:1px solid rgba(255,255,255,0.3);
          flex-shrink:0;
          transition: background .15s ease, box-shadow .15s ease;
        }
        .color-preview-row{
          display:flex; align-items:center; gap:12px;
          margin-bottom:8px;
        }
        .color-swatch{
          width:48px; height:48px; border-radius:12px;
          border:1px solid rgba(255,255,255,0.15);
          flex-shrink:0;
          transition: background .15s ease, box-shadow .15s ease;
        }
        .color-hex{ font-size:11px; color:var(--starlight); letter-spacing:0.05em; }
        .color-slider{
          width:100%; height:10px; -webkit-appearance:none; appearance:none;
          border-radius:999px; outline:none; cursor:pointer;
          border:1px solid rgba(255,255,255,0.1);
          background:linear-gradient(to right, rgba(255,255,255,0.08), rgba(255,255,255,0.18));
        }
        .color-slider::-webkit-slider-thumb{
          -webkit-appearance:none; appearance:none;
          width:22px; height:22px; border-radius:50%;
          background:var(--starlight); border:3px solid var(--void);
          box-shadow:0 0 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.4);
          cursor:grab; margin-top:-1px;
        }
        .color-slider::-webkit-slider-thumb:active{ cursor:grabbing; transform:scale(1.1); }
        .color-slider::-moz-range-thumb{
          width:22px; height:22px; border-radius:50%;
          background:var(--starlight); border:3px solid var(--void);
          box-shadow:0 0 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.4);
          cursor:grab;
        }
        .hue-slider{ height:14px; }
        .color-presets{
          display:flex; flex-wrap:wrap; gap:8px; margin-top:4px;
        }
        .color-preset-btn{
          width:26px; height:26px; border-radius:50%;
          border:1px solid rgba(255,255,255,0.2);
          cursor:pointer; padding:0;
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .color-preset-btn:hover{ transform:scale(1.18); }

        /* Voice reply floating card (background mode) */
        .voice-reply-card{
          position:fixed; bottom:20px; right:20px; z-index:40;
          width:340px; max-width:calc(100vw - 40px);
          padding:14px 16px;
          border-radius:14px;
          border:1.5px solid rgba(94,180,255,0.4);
          background:linear-gradient(135deg, rgba(10,30,60,0.94) 0%, rgba(20,50,100,0.90) 50%, rgba(10,30,70,0.94) 100%);
          backdrop-filter:blur(20px);
          animation: voice-reply-in .4s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes voice-reply-in{
          from{ opacity:0; transform:translateY(20px) scale(0.95); }
          to{ opacity:1; transform:translateY(0) scale(1); }
        }
        .voice-reply-header{
          display:flex; align-items:center; gap:8px; margin-bottom:8px;
        }
        .voice-reply-dot{
          width:8px; height:8px; border-radius:50%; flex-shrink:0;
        }
        .voice-reply-name{
          font-size:13px; font-weight:600; flex:1;
        }
        .voice-reply-close{
          background:transparent; border:none; color:#8683a1;
          cursor:pointer; padding:2px; border-radius:4px;
          display:flex; align-items:center; justify-content:center;
        }
        .voice-reply-close:hover{ color:#eae8f5; background:rgba(255,255,255,0.08); }
        .voice-reply-text{
          font-size:12px; line-height:1.5; color:#eae8f5;
          max-height:200px; overflow-y:auto;
        }
        .voice-reply-text::-webkit-scrollbar{ width:3px; }
        .voice-reply-text::-webkit-scrollbar-thumb{ background:rgba(94,180,255,0.3); border-radius:3px; }

        /* ===== CENTRAL REACTOR LOGO (no solar system — single central logo) ===== */
        .central-reactor-stage{
          position:relative; width:100%; height:100%;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:3vmin; padding:3vmin;
        }
        .central-ambient-glow{
          position:absolute; top:50%; left:50%;
          transform:translate(-50%,-50%);
          width:80vmin; height:80vmin; border-radius:50%;
          pointer-events:none; filter:blur(2vmin);
          transition: opacity .6s ease;
          z-index:0;
        }

        /* Main logo button — besar di tengah */
        .central-logo-btn{
          position:relative;
          width:46vmin; height:46vmin; min-width:280px; min-height:280px;
          border:none; cursor:pointer; background:transparent;
          display:flex; align-items:center; justify-content:center;
          z-index:2;
          transition: filter .6s ease, transform .6s ease;
        }
        .central-logo-btn:hover{ transform:scale(1.02); }
        .central-logo-btn:focus-visible{ outline:2px solid var(--agent-color, #5eead4); outline-offset:8px; border-radius:50%; }

        /* State: switching → redup, ring melambat */
        .ring-state-switching{ filter: brightness(0.4) saturate(0.5); }
        .ring-state-active{ filter: brightness(1.15); }
        .ring-state-idle{ filter: brightness(0.85); }

        /* 5 lapisan ring konsentris — kecepatan rotasi tergantung state */
        .cr-ring{
          position:absolute; top:50%; left:50%;
          border-radius:50%; pointer-events:none;
          border-style:solid; border-color:transparent;
          transition: border-color .6s ease, opacity .6s ease;
        }
        .cr-ring-1{
          width:100%; height:100%;
          border-width:0.3vmin;
          border-top-color:var(--agent-color, #5eead4);
          border-right-color:var(--agent-color, #5eead4);
          border-bottom-color:transparent;
          border-left-color:transparent;
          opacity:0.9;
          animation: cr-spin 8s linear infinite;
        }
        .cr-ring-2{
          width:88%; height:88%;
          border-width:0.2vmin;
          border-top-color:transparent;
          border-right-color:var(--agent-glow, #5eead4);
          border-bottom-color:var(--agent-glow, #5eead4);
          border-left-color:transparent;
          opacity:0.7;
          animation: cr-spin-rev 12s linear infinite;
        }
        .cr-ring-3{
          width:76%; height:76%;
          border-width:0.25vmin;
          border-top-color:var(--agent-color, #5eead4);
          border-right-color:transparent;
          border-bottom-color:transparent;
          border-left-color:var(--agent-color, #5eead4);
          opacity:0.8;
          animation: cr-spin 6s linear infinite;
        }
        .cr-ring-4{
          width:64%; height:64%;
          border-width:0.15vmin;
          border-style:dashed;
          border-color:var(--agent-glow, #5eead4);
          opacity:0.5;
          animation: cr-spin-rev 10s linear infinite;
        }
        .cr-ring-5{
          width:52%; height:52%;
          border-width:0.2vmin;
          border-top-color:transparent;
          border-right-color:transparent;
          border-bottom-color:var(--agent-color, #5eead4);
          border-left-color:var(--agent-color, #5eead4);
          opacity:0.7;
          animation: cr-spin 5s linear infinite;
        }

        /* State active (speaking) — semua ring berputar lebih cepat */
        .ring-state-active .cr-ring-1{ animation-duration:3s; }
        .ring-state-active .cr-ring-2{ animation-duration:4s; }
        .ring-state-active .cr-ring-3{ animation-duration:2.5s; }
        .ring-state-active .cr-ring-4{ animation-duration:3.5s; }
        .ring-state-active .cr-ring-5{ animation-duration:2s; }
        .ring-state-active .cr-ring{ opacity:1; filter:brightness(1.3); }

        /* State switching — ring melambat & redup */
        .ring-state-switching .cr-ring-1{ animation-duration:20s; }
        .ring-state-switching .cr-ring-2{ animation-duration:24s; }
        .ring-state-switching .cr-ring-3{ animation-duration:18s; }
        .ring-state-switching .cr-ring-4{ animation-duration:22s; }
        .ring-state-switching .cr-ring-5{ animation-duration:16s; }
        .ring-state-switching .cr-ring{ opacity:0.3; }

        @keyframes cr-spin{ from{ transform:translate(-50%,-50%) rotate(0deg); } to{ transform:translate(-50%,-50%) rotate(360deg); } }
        @keyframes cr-spin-rev{ from{ transform:translate(-50%,-50%) rotate(360deg); } to{ transform:translate(-50%,-50%) rotate(0deg); } }

        /* Tick marks (HUD style) di ring terluar */
        .cr-ticks{
          position:absolute; top:50%; left:50%;
          width:100%; height:100%;
          transform:translate(-50%,-50%);
          pointer-events:none;
          animation: cr-spin 60s linear infinite;
        }
        .ring-state-active .cr-ticks{ animation-duration:20s; }
        .ring-state-switching .cr-ticks{ animation-duration:120s; opacity:0.3; }
        .cr-tick{
          position:absolute; top:0; left:50%;
          width:1px; height:1.2vmin;
          background:var(--agent-color, #5eead4);
          opacity:0.4;
          transform-origin:0 23vmin;
        }
        .cr-tick:nth-child(5n){ height:1.8vmin; opacity:0.7; }

        /* Core particle wrap (Arc Reactor) */
        .cr-core-wrap{
          position:absolute; top:50%; left:50%;
          width:42%; height:42%;
          transform:translate(-50%,-50%);
          border-radius:50%;
          overflow:hidden;
        }

        /* Pulse rings saat speaking */
        .cr-pulse-ring{
          position:absolute; top:50%; left:50%;
          width:50%; height:50%;
          border-radius:50%;
          border:2px solid transparent;
          transform:translate(-50%,-50%);
          pointer-events:none;
          animation: cr-pulse 2s ease-out infinite;
        }
        .cr-pulse-2{ animation-delay:1s; }
        @keyframes cr-pulse{
          0%{ width:50%; height:50%; opacity:1; }
          100%{ width:100%; height:100%; opacity:0; }
        }

        /* Status & role labels */
        .cr-status-label{
          position:absolute; top:-3.5vmin; left:50%;
          transform:translateX(-50%);
          font-size:1.6vmin; letter-spacing:0.3em;
          color:var(--agent-glow, #5eead4);
          opacity:0.8;
          white-space:nowrap;
        }
        .cr-role-label{
          position:absolute; bottom:-3.5vmin; left:50%;
          transform:translateX(-50%);
          font-size:1.4vmin; letter-spacing:0.25em;
          opacity:0.7;
          white-space:nowrap;
        }

        /* Hamburger button (3-strip menu toggle) */
        .hamburger-btn{ border-radius:8px !important; }
        .hamburger-btn:hover{ background:rgba(94,234,212,0.15) !important; color:var(--ion) !important; }
        .hamburger-floating{
          position:fixed; top:64px; left:16px; z-index:41;
          background:rgba(5,6,13,0.7); backdrop-filter:blur(10px);
          border:1px solid rgba(255,255,255,0.1);
        }

        /* Voice listening indicator */
        .voice-listening-pill{
          color:#5eead4 !important;
          border-color:rgba(94,234,212,0.4) !important;
          background:rgba(94,234,212,0.08) !important;
          font-size:10px !important;
        }
        .voice-listening-dot{
          width:6px; height:6px; border-radius:50%;
          background:#5eead4;
          box-shadow:0 0 6px #5eead4;
          animation: voice-pulse 1.5s ease-in-out infinite;
        }
        @keyframes voice-pulse{
          0%,100%{ opacity:0.4; transform:scale(0.8); }
          50%{ opacity:1; transform:scale(1.2); }
        }
        .voice-error-pill{
          color:#ff8080 !important;
          border-color:rgba(255,128,128,0.4) !important;
          background:rgba(255,128,128,0.08) !important;
          font-size:10px !important;
        }

        @media (max-width: 768px){
          .central-logo-btn{ width:60vmin; height:60vmin; }
          .cr-status-label{ font-size:2.4vmin; top:-5vmin; }
          .cr-role-label{ font-size:2.2vmin; bottom:-5vmin; }
        }
      `}</style>

      <GalaxyField />

      <header className="topbar">
        <div className="brand">
          <div>
            <div className="brand-title">ARTECH</div>
            <div className="brand-sub">multi-agent orchestrator</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="top-actions">
          {listening && (
            <span className="pill font-mono voice-listening-pill" title="Voice recognition aktif — sebut nama agent atau greeting">
              <span className="voice-listening-dot" />
              Listening
            </span>
          )}
          {voiceError && (
            <span className="pill font-mono voice-error-pill" title={voiceError}>
              <AlertCircle size={12} /> Mic
            </span>
          )}
          {sessionInfo?.mode === "bypass" && sessionInfo.activeAgentId && (() => {
            const sb = getBody(sessionInfo.activeAgentId);
            if (!sb) return null;
            return (
              <button
                className="pill font-mono session-pill"
                onClick={() => {
                  fetch("/api/sessions/" + sessionInfo.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ended_user" }) });
                  setSessionInfo(null);
                  showToast(`Sesi dengan ${sb.name} diputus.`, "info");
                }}
                title={`Sesi aktif: ${sb.name}. Klik untuk memutus.`}
                style={{ color: sb.color, borderColor: `${sb.color}66`, background: `${sb.color}1a` }}
              >
                <span className="session-dot" style={{ background: sb.color, boxShadow: `0 0 0.6vmin ${sb.color}` }} />
                Sesi: {sb.name}
                <X size={12} />
              </button>
            );
          })()}
          <button
            className="pill font-mono"
            onClick={() => setSettings((s) => ({ ...s, autonomousMode: !s.autonomousMode }))}
            style={{ color: settings.autonomousMode ? "#5eead4" : "#8683a1", borderColor: settings.autonomousMode ? "rgba(94,234,212,0.4)" : "rgba(255,255,255,0.1)" }}
          >
            <Power size={12} /> {settings.autonomousMode ? "Otonom aktif" : "Otonom"}
          </button>
          <div className="pill font-mono" style={{ color: connected ? "#5eead4" : "#8683a1", cursor: "default" }}>
            {connected ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} n8n {connected ? "siap" : "belum diatur"}
          </div>
          {dbStatus === "fallback" && (
            <a
              href="/debug"
              className="pill font-mono"
              style={{ color: "#ffcf8f", borderColor: "rgba(255,180,84,0.4)", background: "rgba(255,180,84,0.08)", cursor: "pointer" }}
              title="Database belum terhubung. Klik untuk debug."
            >
              <AlertCircle size={12} /> DB belum setup
            </a>
          )}
          <button className="icon-btn" onClick={() => setSettings((s) => ({ ...s, voiceEnabled: !s.voiceEnabled }))} title="Suara agent" aria-label="Toggle suara">
            {settings.voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Pengaturan" aria-label="Pengaturan">
            <Settings size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={async () => {
              if (!confirm("Logout dari dashboard?")) return;
              try {
                await fetch("/api/auth/logout", { method: "POST" });
              } catch {}
              window.location.href = "/login";
            }}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
        </div>
      </header>

      <main className="main">
        <Roster
          allBodies={allBodies}
          selectedId={selectedId}
          onSelect={select}
          onEdit={(id) => setRenameAgentId(id)}
          onDelete={handleDeleteAgent}
          connected={connected}
          collapsed={rosterCollapsed}
          onToggleCollapse={() => setRosterCollapsed((v) => !v)}
          onAddAgent={() => setAddAgentOpen(true)}
        />

        <div className="orbit-stage">
          <CentralReactorLogo
            allBodies={allBodies}
            activeAgentId={sessionInfo?.activeAgentId || selectedId}
            speakingId={speakingId}
            switching={switchingAgent}
            onSelect={select}
            onToggleChat={handleToggleChat}
            coreMeta={coreMeta}
          />
        </div>
      </main>

      <HoloDrawer
        body={selectedBody}
        messages={selectedMessages}
        open={!!drawerAgentId}
        onClose={() => setDrawerAgentId(null)}
        onSend={() => drawerAgentId && handleSend(drawerAgentId)}
        input={selectedInput}
        onInputChange={(v) => drawerAgentId && setInputs((prev) => ({ ...prev, [drawerAgentId]: v }))}
        pendingFiles={selectedPendingFiles}
        onAddFiles={(files) => drawerAgentId && addFiles(drawerAgentId, files)}
        onRemoveFile={(idx) => drawerAgentId && removeFile(drawerAgentId, idx)}
        sending={!!(drawerAgentId && sending[drawerAgentId])}
        speaking={speakingId === drawerAgentId}
        voiceEnabled={settings.voiceEnabled}
        webhookConfigured={webhookConfigured}
        onRename={(id) => setRenameAgentId(id)}
        onToggleVoice={() => saveSettings({ ...settings, voiceEnabled: !settings.voiceEnabled })}
      />

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={saveSettings}
          onClose={() => setSettingsOpen(false)}
          onTest={testConnection}
          testState={testState}
          onReset={resetAll}
          allBodies={allBodies}
        />
      )}

      {addAgentOpen && <AddAgentModal onClose={() => setAddAgentOpen(false)} onAdd={handleAddAgent} />}
      {renameAgentId && <RenameAgentModal body={getBody(renameAgentId)} onClose={() => setRenameAgentId(null)} onRename={handleRenameAgent} voices={voices} />}

      {toast && (
        <div className="toast glass-panel font-mono" style={{ color: toast.type === "error" ? "#ff8080" : toast.type === "level" ? "#ffb454" : "#eae8f5" }} key={toast.key}>
          {toast.msg}
        </div>
      )}

      {/* Voice reply floating notification (background mode) */}
      {voiceReply && (
        <div className="voice-reply-card" style={{ borderColor: `${voiceReply.color}66`, boxShadow: `0 0 2vmin ${voiceReply.color}33, 0 0 1vmin ${voiceReply.color}22` }}>
          <div className="voice-reply-header">
            <span className="voice-reply-dot" style={{ background: voiceReply.color, boxShadow: `0 0 0.6vmin ${voiceReply.color}` }} />
            <span className="font-display voice-reply-name" style={{ color: voiceReply.color }}>{voiceReply.agentName}</span>
            <button className="voice-reply-close" onClick={() => setVoiceReply(null)} aria-label="Tutup">
              <X size={14} />
            </button>
          </div>
          <div className="voice-reply-text font-mono">{voiceReply.text}</div>
        </div>
      )}
    </div>
  );
}
