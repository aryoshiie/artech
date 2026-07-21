// src/lib/routing.ts — Routing Lapis 1 (deteksi nama agent di 2 kata pertama + filler)
//
// Alur:
// 1. User intent masuk
// 2. Cek 2 kata pertama (skip filler seperti "hey", "tolong", "hai")
// 3. Exact match (case-insensitive) dengan nama agent atau routingKeywords
// 4. Jika match → MODE BYPASS (kirim langsung ke agent tsb)
// 5. Jika tidak match → MODE DEFAULT (kirim ke orchestrator)
// 6. Auto-switch: kalau user sebut agent lain (termasuk orchestrator), session pindah
// 7. Session berakhir kalau:
//    - Agent kirim sinyal endSession (mode bypass)
//    - User kirim intent disconnect (isDisconnectIntent)
//    - Idle 30 menit (di-handle cron / middleware)

import { db } from "./db";

// Filler yang diizinkan sebelum nama agent (skip kata-kata ini)
const FILLERS = new Set([
  "hey", "hai", "halo", "hi", "oi", "woi", "eh",
  "tolong", "mohon", "please", "coba", "bisa", "bantu",
  "ya", "yaudah", "oke", "ok",
]);

export interface RoutingResult {
  mode: "default" | "bypass";
  targetAgentId: string;       // agent yang akan dikirimi pesan
  mentionedAgentId: string | null;  // agent yang disebut di 2 kata pertama (kalau ada)
  isDisconnect: boolean;       // user ingin putuskan sesi
  isSwitch: boolean;           // user pindah agent di tengah sesi
}

/**
 * Normalisasi kata: lowercase + strip punctuation di awal/akhir.
 */
function normalizeWord(w: string): string {
  return (w || "").toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

/**
 * Ambil 2 kata pertama yang "signifikan" (skip filler).
 * Mis. "tolong luna kirim resi" → ["luna", "kirim"]
 * Mis. "hey jupiter analisa ini" → ["jupiter", "analisa"]
 */
function getFirstTwoMeaningfulWords(text: string): string[] {
  const words = text.trim().split(/\s+/).map(normalizeWord).filter(Boolean);
  const meaningful: string[] = [];
  for (const w of words) {
    if (FILLERS.has(w)) continue;
    meaningful.push(w);
    if (meaningful.length >= 2) break;
  }
  return meaningful;
}

/**
 * Cek apakah teks adalah intent disconnect (akhiri sesi).
 */
export function isDisconnectIntent(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const phrases = [
    "putuskan sambungan", "putus sambungan", "putuskan", "akhiri sesi", "akhir sesi",
    "tutup sesi", "tutup koneksi", "disconnect", "end session", "end call",
    "kembali ke orchestrator", "kembali ke pusat", "kembali ke inti",
    "selesai bicara", "selesaikan sesi", "lepaskan sambungan", "putuskan komunikasi",
    "keluar dari agent", "kembali ke awal", "reset sesi",
  ];
  return phrases.some((p) => t.includes(p));
}

/**
 * Bandingkan kata dengan nama agent / keywords (exact match, case-insensitive).
 * Exact match berarti kata harus persis sama dengan nama atau salah satu keyword.
 */
function exactMatchAgent(word: string, agent: { name: string; routingKeywords?: string | null; id: string }): boolean {
  if (!word || word.length < 2) return false;
  const name = agent.name.toLowerCase().trim();
  if (word === name) return true;
  // Slug ID match (mis. "luna" → id "luna")
  if (word === agent.id.toLowerCase()) return true;
  // routingKeywords CSV match
  if (agent.routingKeywords) {
    const kws = agent.routingKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (kws.includes(word)) return true;
  }
  return false;
}

/**
 * Routing Lapis 1 — deteksi agent dari 2 kata pertama.
 *
 * @param text      Pesan user
 * @param agents    Daftar semua agent (dari DB, termasuk Inti Galaksi)
 * @returns RoutingResult
 */
export function parseAgentMention(
  text: string,
  agents: Array<{ id: string; name: string; routingKeywords?: string | null; isCore?: boolean }>
): string | null {
  if (!text) return null;
  const meaningful = getFirstTwoMeaningfulWords(text);
  if (meaningful.length === 0) return null;

  // Cek kata pertama dulu, lalu kata kedua (kalau kata pertama bukan nama agent)
  for (const word of meaningful) {
    for (const agent of agents) {
      if (exactMatchAgent(word, agent)) {
        return agent.id;
      }
    }
  }
  return null;
}

/**
 * Routing lengkap: tentukan mode + target agent berdasarkan intent + session aktif.
 *
 * @param text          Pesan user
 * @param agents        Daftar semua agent
 * @param activeSession Session aktif (kalau ada) — punya mode & activeAgentId
 */
export async function routeMessage(
  text: string,
  agents: Array<{ id: string; name: string; routingKeywords?: string | null; isCore?: boolean }>,
  activeSession?: { id: string; mode: "default" | "bypass"; activeAgentId?: string | null } | null
): Promise<RoutingResult> {
  const mentioned = parseAgentMention(text, agents);
  const isDisconnect = isDisconnectIntent(text);

  // Dapatkan orchestrator (agent dengan isCore=true, atau id="orchestrator")
  const orchestrator = agents.find((a) => a.isCore) || agents.find((a) => a.id === "orchestrator") || agents[0];

  // Kasus 1: User mention agent spesifik di awal → MODE BYPASS (atau switch agent)
  if (mentioned) {
    const isSwitch = activeSession?.activeAgentId && activeSession.activeAgentId !== mentioned;
    return {
      mode: "bypass",
      targetAgentId: mentioned,
      mentionedAgentId: mentioned,
      isDisconnect: false,
      isSwitch: Boolean(isSwitch),
    };
  }

  // Kasus 2: Ada session aktif dengan mode bypass → lanjut ke agent tsb (continuous)
  if (activeSession?.mode === "bypass" && activeSession.activeAgentId && !isDisconnect) {
    return {
      mode: "bypass",
      targetAgentId: activeSession.activeAgentId,
      mentionedAgentId: null,
      isDisconnect: false,
      isSwitch: false,
    };
  }

  // Kasus 3: Disconnect intent → akhiri sesi, kembali ke orchestrator
  if (isDisconnect) {
    return {
      mode: "default",
      targetAgentId: orchestrator.id,
      mentionedAgentId: null,
      isDisconnect: true,
      isSwitch: false,
    };
  }

  // Kasus 4: Default → orchestrator
  return {
    mode: "default",
    targetAgentId: orchestrator.id,
    mentionedAgentId: null,
    isDisconnect: false,
    isSwitch: false,
  };
}

/**
 * Get atau create session aktif untuk conversation thread tertentu.
 * Untuk versi pertama ini, kita pakai 1 session per browser (berdasarkan cookie/sessionStorage).
 */
export async function getOrCreateSession(sessionKey: string): Promise<{
  id: string;
  mode: "default" | "bypass";
  activeAgentId?: string | null;
} | null> {
  const existing = await db.session.findFirst({
    where: {
      id: sessionKey,
      status: "active",
    },
  });
  if (existing) {
    // Cek idle timeout
    const settings = await db.settings.findUnique({ where: { id: "singleton" } });
    const timeoutMin = settings?.sessionIdleTimeoutMin ?? 30;
    const idleMs = Date.now() - existing.lastActivityAt.getTime();
    if (idleMs > timeoutMin * 60 * 1000) {
      // Session expired → tutup, buat baru
      await db.session.update({
        where: { id: existing.id },
        data: { status: "ended_idle", endedAt: new Date() },
      });
    } else {
      return existing;
    }
  }
  // Buat session baru
  const created = await db.session.create({
    data: {
      id: sessionKey,
      mode: "default",
      status: "active",
      startedAt: new Date(),
      lastActivityAt: new Date(),
    },
  });
  return created;
}

/**
 * Update session setelah routing decision.
 */
export async function updateSessionAfterRouting(
  sessionId: string,
  routing: RoutingResult
): Promise<void> {
  if (routing.isDisconnect) {
    await db.session.update({
      where: { id: sessionId },
      data: {
        status: "ended_user",
        endedAt: new Date(),
        activeAgentId: null,
        mode: "default",
      },
    });
    return;
  }
  await db.session.update({
    where: { id: sessionId },
    data: {
      mode: routing.mode,
      activeAgentId: routing.targetAgentId,
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Akhiri session karena agent mengirim sinyal endSession.
 */
export async function endSessionByAgent(sessionId: string): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: {
      status: "ended_agent",
      endedAt: new Date(),
      activeAgentId: null,
      mode: "default",
    },
  });
}
