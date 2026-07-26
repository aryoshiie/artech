// src/app/api/ai/tts/route.ts — StreamElements TTS (multiple voices, no package)
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

// StreamElements voices (gratis, multiple gender)
const VOICES: Record<string, string> = {
  male: "Brian",        // Male, deep voice
  female: "Joanna",     // Female, natural
  neutral: "Matthew",   // Male, neutral
};

export async function POST(req: NextRequest) {
  try {
    const { text, gender = "male" } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }
    
    const cleanText = encodeURIComponent(text.slice(0, 500));
    const voice = VOICES[gender] || VOICES.male;
    const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${cleanText}`;
    
    const res = await fetch(ttsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    
    if (!res.ok) {
      // Fallback ke Google Translate TTS
      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${cleanText}&tl=id&client=tw-ob`;
      const googleRes = await fetch(googleUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (googleRes.ok) {
        const audioBuffer = await googleRes.arrayBuffer();
        return new Response(audioBuffer, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
        });
      }
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
    }
    
    const audioBuffer = await res.arrayBuffer();
    
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error("[TTS] Error:", err?.message || err);
    return NextResponse.json(
      { error: "TTS generation failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const text = url.searchParams.get("text") || "Halo, ini test suara";
  const gender = url.searchParams.get("gender") || "male";
  
  try {
    const cleanText = encodeURIComponent(text.slice(0, 500));
    const voice = VOICES[gender] || VOICES.male;
    const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${cleanText}`;
    
    const res = await fetch(ttsUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    
    if (!res.ok) {
      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${cleanText}&tl=id&client=tw-ob`;
      const googleRes = await fetch(googleUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (googleRes.ok) {
        const audioBuffer = await googleRes.arrayBuffer();
        return new Response(audioBuffer, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
        });
      }
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
    }
    
    const audioBuffer = await res.arrayBuffer();
    
    return new Response(audioBuffer, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "TTS failed", details: err?.message }, { status: 500 });
  }
}
