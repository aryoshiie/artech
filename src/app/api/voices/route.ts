// src/app/api/voices/route.ts
// Return daftar voice "umum" yang biasanya tersedia di Chrome.
// Frontend pakai ini sebagai fallback kalau speechSynthesis.getVoices() belum loaded.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface VoiceSuggestion {
  name: string;
  lang: string;
  recommended?: boolean;
}

const VOICES: VoiceSuggestion[] = [
  { name: "Google Bahasa Indonesia", lang: "id-ID", recommended: true },
  { name: "Google US English", lang: "en-US", recommended: true },
  { name: "Google UK English Female", lang: "en-GB" },
  { name: "Google UK English Male", lang: "en-GB" },
  { name: "Google 日本語", lang: "ja-JP" },
  { name: "Google 한국의", lang: "ko-KR" },
  { name: "Google 普通话（中国大陆）", lang: "zh-CN" },
  { name: "Google Deutsch", lang: "de-DE" },
  { name: "Google français", lang: "fr-FR" },
  { name: "Google español", lang: "es-ES" },
  { name: "Microsoft Andika - Indonesian (Indonesia)", lang: "id-ID" },
  { name: "Microsoft David - English (United States)", lang: "en-US" },
];

export async function GET() {
  return NextResponse.json({ voices: VOICES });
}
